import { App, PluginSettingTab, Setting } from "obsidian";
import GitPrepPlugin from "./main";

export interface GitPrepSettings {
  outputFolderName: string;
  assetsFolderName: string;
  convertWikilinks: boolean;
}

export const DEFAULT_SETTINGS: GitPrepSettings = {
  outputFolderName: "git-export",
  assetsFolderName: "assets",
  convertWikilinks: true,
};

export class GitPrepSettingTab extends PluginSettingTab {
  plugin: GitPrepPlugin;

  constructor(app: App, plugin: GitPrepPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Output folder name")
      .setDesc("Folder created at the vault root for prepared files.")
      .addText((text) =>
        text
          .setPlaceholder("git-export")
          .setValue(this.plugin.settings.outputFolderName)
          .onChange(async (value) => {
            this.plugin.settings.outputFolderName = value.trim() || "git-export";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Assets folder name")
      .setDesc("Subfolder under the output folder for images.")
      .addText((text) =>
        text
          .setPlaceholder("assets")
          .setValue(this.plugin.settings.assetsFolderName)
          .onChange(async (value) => {
            this.plugin.settings.assetsFolderName = value.trim() || "assets";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Convert wikilinks")
      .setDesc("Convert [[note]] links to standard Markdown links.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.convertWikilinks)
          .onChange(async (value) => {
            this.plugin.settings.convertWikilinks = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
