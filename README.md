[中文](README.zh-CN.md)

# SiYuan Export

Export every notebook in a local SiYuan workspace to Markdown.

## Features

* Opens an export panel from the top bar or command palette.
* Saves the Python command and output directory.
* Checks the selected Python runtime before export.
* Reads documents through SiYuan's API and produces a notebook-based Markdown hierarchy.
* Copies attachments to `assets/` and rewrites Markdown links to them.
* Shows live export output and errors in the panel.

## Requirements

* SiYuan desktop 3.7.0 or later.
* Python 3 available locally. Leave the runtime blank to use `/usr/bin/python3` on macOS, `python3` on Linux, or `py -3` on Windows.

## Usage

1. Install and enable the plugin in SiYuan desktop.
2. Open **Notebook Export** from the top bar or command palette.
3. Enter an export directory.
4. Optionally select a Python executable or command.
5. Choose **Start export** and follow the export log.

The plugin reads documents and attachments through SiYuan's API. Markdown files are written to the chosen export directory. Existing files at the same output paths are overwritten.

## Development

```bash
pnpm install
pnpm run dev
```

Run `pnpm run build` to create `package.zip`. The package contains the compiled plugin, translations, metadata, images, documentation, and bundled Python exporter.
