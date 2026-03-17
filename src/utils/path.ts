import { App, TFolder, normalizePath } from "obsidian";

export function joinPath(...parts: string[]): string {
  const joined = parts
    .filter((p) => p && p.length > 0)
    .map((p) => p.replace(/\\/g, "/"))
    .join("/");
  return normalizePath(joined);
}

export function dirname(path: string): string {
  const norm = normalizePath(path);
  const idx = norm.lastIndexOf("/");
  if (idx === -1) return "";
  return norm.slice(0, idx);
}

export function relativePath(fromDir: string, toPath: string): string {
  const fromParts = normalizePath(fromDir).split("/").filter(Boolean);
  const toParts = normalizePath(toPath).split("/").filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }
  const upCount = fromParts.length - i;
  const relParts: string[] = [];
  for (let j = 0; j < upCount; j++) relParts.push("..");
  relParts.push(...toParts.slice(i));
  return relParts.length === 0 ? "." : relParts.join("/");
}

export async function ensureFolder(app: App, path: string): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    if (!(existing instanceof TFolder)) {
      throw new Error(`Expected folder at ${path}, but found a file.`);
    }
    return;
  }
  const parent = dirname(path);
  if (parent && parent !== path) {
    await ensureFolder(app, parent);
  }
  await app.vault.createFolder(path);
}

export function sanitizeFileName(name: string): string {
  return name.replace(/ /g, "_");
}

export function isInFolder(path: string, folderPath: string): boolean {
  const normPath = normalizePath(path);
  const normFolder = normalizePath(folderPath);
  return normPath === normFolder || normPath.startsWith(`${normFolder}/`);
}
