import { Notice, TFolder } from "obsidian";
import GitPrepPlugin from "../main";
import { FolderSuggestModal } from "../ui/folder-suggest";
import { prepareFolder } from "../processor/prepare-folder";

export function registerCommands(plugin: GitPrepPlugin) {
  plugin.addCommand({
    id: "prepare-folder-for-git",
    name: "Prepare folder for Git upload",
    callback: async () => {
      const modal = new FolderSuggestModal(plugin.app, async (folder: TFolder) => {
        new Notice(`Preparing "${folder.path}"...`);
        try {
          const report = await prepareFolder(plugin.app, folder, plugin.settings);
          new Notice(
            `Prepared ${report.filesProcessed} files and ${report.assetsCopied} images into "${report.outputRoot}".`
          );
        } catch (err) {
          console.error(err);
          new Notice("Preparation failed. Check console for details.");
        }
      });
      modal.open();
    },
  });
}
