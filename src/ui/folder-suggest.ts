import { App, SuggestModal, TFolder } from "obsidian";

export class FolderSuggestModal extends SuggestModal<TFolder> {
  private folders: TFolder[];
  private onSelect: (folder: TFolder) => void | Promise<void>;

  constructor(app: App, onSelect: (folder: TFolder) => void | Promise<void>) {
    super(app);
    this.onSelect = onSelect;
    this.folders = this.getAllFolders(app);
    this.setPlaceholder("Select a folder to prepare");
  }

  getSuggestions(query: string): TFolder[] {
    const q = query.toLowerCase();
    return this.folders.filter((folder) => folder.path.toLowerCase().includes(q));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement) {
    el.setText(folder.path);
  }

  async onChooseSuggestion(folder: TFolder) {
    await this.onSelect(folder);
  }

  private getAllFolders(app: App): TFolder[] {
    const files = app.vault.getAllLoadedFiles();
    const folders: TFolder[] = [];
    for (const file of files) {
      if (file instanceof TFolder) {
        folders.push(file);
      }
    }
    folders.sort((a, b) => a.path.localeCompare(b.path));
    return folders;
  }
}
