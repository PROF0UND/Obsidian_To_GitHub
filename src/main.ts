import { Plugin } from "obsidian";
import { GitPrepSettingTab, GitPrepSettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class GitPrepPlugin extends Plugin {
  settings: GitPrepSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    registerCommands(this);
    this.addSettingTab(new GitPrepSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
