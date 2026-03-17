# Obsidian To GitHub (Vault Prep)

Prepare a folder of Obsidian notes for GitHub by exporting Markdown and referenced images into a clean, shareable structure.

## What it does
- Prompts you to select a vault folder.
- Exports Markdown files into an output folder at the vault root.
- Converts Obsidian image embeds to standard Markdown links.
- Copies referenced images into an `assets/` folder and replaces spaces with underscores.
- Optionally converts `[[wikilinks]]` to standard Markdown links.

## Install (local dev)
1. Place this repo at `<Vault>/.obsidian/plugins/obsidian-to-github/`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Use
1. Open the Command Palette.
2. Run **Prepare folder for Git upload**.
3. Choose a folder. The exported files appear in the output folder.

## Settings
- Output folder name (default: `git-export`)
- Assets folder name (default: `assets`)
- Convert wikilinks
