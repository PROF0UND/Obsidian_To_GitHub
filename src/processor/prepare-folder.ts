import { App, TFile, TFolder, normalizePath } from "obsidian";
import { GitPrepSettings } from "../settings";
import {
  dirname,
  ensureFolder,
  isInFolder,
  joinPath,
  relativePath,
  sanitizeFileName,
} from "../utils/path";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "bmp",
  "tiff",
  "tif",
  "avif",
]);

interface AssetInfo {
  file: TFile;
  newName: string;
}

export interface PrepareReport {
  outputRoot: string;
  filesProcessed: number;
  assetsCopied: number;
  linksConverted: number;
  wikilinksConverted: number;
  missingAssets: number;
}

export async function prepareFolder(
  app: App,
  sourceFolder: TFolder,
  settings: GitPrepSettings
): Promise<PrepareReport> {
  const outputRoot = await getUniqueOutputRoot(app, settings.outputFolderName, sourceFolder.name);
  const assetsFolder = joinPath(outputRoot, settings.assetsFolderName);

  await ensureFolder(app, outputRoot);
  await ensureFolder(app, assetsFolder);

  const markdownFiles = app.vault
    .getMarkdownFiles()
    .filter((file) => isInFolder(file.path, sourceFolder.path));

  const assetMap = new Map<string, AssetInfo>();
  const usedAssetNames = new Set<string>();

  let filesProcessed = 0;
  let linksConverted = 0;
  let wikilinksConverted = 0;
  let missingAssets = 0;

  for (const file of markdownFiles) {
    const sourcePath = file.path;
    const relPath = normalizePath(sourcePath).slice(normalizePath(sourceFolder.path).length);
    const outputPath = joinPath(outputRoot, relPath.replace(/^\//, ""));
    const outputDir = dirname(outputPath);
    if (outputDir) {
      await ensureFolder(app, outputDir);
    }

    const content = await app.vault.read(file);
    const result = transformMarkdown(
      app,
      content,
      sourcePath,
      outputPath,
      sourceFolder.path,
      outputRoot,
      assetsFolder,
      settings,
      (assetFile) => getOrCreateAsset(assetFile, assetMap, usedAssetNames)
    );

    linksConverted += result.linksConverted;
    wikilinksConverted += result.wikilinksConverted;
    missingAssets += result.missingAssets;

    await app.vault.create(outputPath, result.text);
    filesProcessed++;
  }

  for (const asset of assetMap.values()) {
    const destPath = joinPath(assetsFolder, asset.newName);
    const data = await app.vault.readBinary(asset.file);
    await app.vault.createBinary(destPath, data);
  }

  return {
    outputRoot,
    filesProcessed,
    assetsCopied: assetMap.size,
    linksConverted,
    wikilinksConverted,
    missingAssets,
  };
}

function transformMarkdown(
  app: App,
  content: string,
  sourcePath: string,
  outputPath: string,
  sourceFolderPath: string,
  outputRoot: string,
  assetsFolder: string,
  settings: GitPrepSettings,
  registerAsset: (file: TFile) => AssetInfo
): { text: string; linksConverted: number; wikilinksConverted: number; missingAssets: number } {
  let linksConverted = 0;
  let wikilinksConverted = 0;
  let missingAssets = 0;

  const embedRegex = /!\[\[([^\]]+)\]\]/g;
  content = content.replace(embedRegex, (full, inner) => {
    const { linkpath, alias } = splitAlias(inner);
    const cleanPath = stripHeadingAndBlock(linkpath);
    const file = app.metadataCache.getFirstLinkpathDest(cleanPath, sourcePath);
    if (!file || !(file instanceof TFile)) return full;
    if (!isImageFile(file)) return full;

    const asset = registerAsset(file);
    const alt = alias || file.basename;
    const rel = relativePath(dirname(outputPath), joinPath(assetsFolder, asset.newName));
    linksConverted++;
    return `![${alt}](${rel})`;
  });

  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  content = content.replace(mdImageRegex, (full, altText, rawTarget) => {
    const parsed = parseMarkdownTarget(rawTarget);
    if (!parsed) return full;
    const { target, title } = parsed;
    if (isExternalTarget(target)) return full;

    const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
    if (!file || !(file instanceof TFile)) {
      missingAssets++;
      return full;
    }
    if (!isImageFile(file)) return full;

    const asset = registerAsset(file);
    const rel = relativePath(dirname(outputPath), joinPath(assetsFolder, asset.newName));
    linksConverted++;
    return `![${altText}](${rel}${title ? ` ${title}` : ""})`;
  });

  if (settings.convertWikilinks) {
    const wikiRegex = /\[\[([^\]]+)\]\]/g;
    content = content.replace(wikiRegex, (full, inner, offset, str) => {
      if (offset > 0 && str[offset - 1] === "!") return full;

      const { linkpath, alias } = splitAlias(inner);
      const cleanPath = stripHeadingAndBlock(linkpath);
      const file = app.metadataCache.getFirstLinkpathDest(cleanPath, sourcePath);
      if (!file || !(file instanceof TFile)) return full;
      if (file.extension !== "md") return full;
      if (!isInFolder(file.path, sourceFolderPath)) return full;

      const targetOutputPath = sourceToOutputPath(sourceFolderPath, outputRoot, file.path);
      const rel = relativePath(dirname(outputPath), targetOutputPath);
      const text = alias || file.basename;
      wikilinksConverted++;
      return `[${text}](${rel})`;
    });
  }

  return { text: content, linksConverted, wikilinksConverted, missingAssets };
}

function splitAlias(inner: string): { linkpath: string; alias: string | null } {
  const pipeIndex = inner.indexOf("|");
  if (pipeIndex === -1) {
    return { linkpath: inner.trim(), alias: null };
  }
  const linkpath = inner.slice(0, pipeIndex).trim();
  const alias = inner.slice(pipeIndex + 1).trim();
  return { linkpath, alias: alias || null };
}

function stripHeadingAndBlock(linkpath: string): string {
  const hashIndex = linkpath.indexOf("#");
  const blockIndex = linkpath.indexOf("^");
  const cutIndex =
    hashIndex === -1 ? blockIndex : blockIndex === -1 ? hashIndex : Math.min(hashIndex, blockIndex);
  if (cutIndex === -1) return linkpath;
  return linkpath.slice(0, cutIndex);
}

function isImageFile(file: TFile): boolean {
  return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

function parseMarkdownTarget(rawTarget: string): { target: string; title: string | null } | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) return null;

  const withoutAngles =
    trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed.slice(1, -1) : trimmed;

  const match = withoutAngles.match(/^(.*?)(\s+["'][^"']*["'])?$/);
  if (!match) return null;
  const target = match[1].trim();
  const title = match[2] ? match[2].trim() : null;
  return { target, title };
}

function isExternalTarget(target: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|#)/i.test(target);
}

function getOrCreateAsset(
  file: TFile,
  assetMap: Map<string, AssetInfo>,
  usedNames: Set<string>
): AssetInfo {
  const existing = assetMap.get(file.path);
  if (existing) return existing;

  const sanitizedBase = sanitizeFileName(file.basename);
  const ext = file.extension;
  let candidate = `${sanitizedBase}.${ext}`;
  let suffix = 1;
  while (usedNames.has(candidate)) {
    suffix++;
    candidate = `${sanitizedBase}_${suffix}.${ext}`;
  }
  usedNames.add(candidate);

  const asset = { file, newName: candidate };
  assetMap.set(file.path, asset);
  return asset;
}

async function getUniqueOutputRoot(
  app: App,
  baseFolderName: string,
  sourceFolderName: string
): Promise<string> {
  const base = joinPath(baseFolderName || "git-export", sourceFolderName);
  let candidate = base;
  let i = 1;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = `${base}-${i}`;
    i++;
  }
  return candidate;
}

function sourceToOutputPath(
  sourceFolderPath: string,
  outputRoot: string,
  sourcePath: string
): string {
  const sourceRoot = normalizePath(sourceFolderPath);
  const normSource = normalizePath(sourcePath);
  const rel = normSource.slice(sourceRoot.length).replace(/^\//, "");
  return joinPath(outputRoot, rel);
}
