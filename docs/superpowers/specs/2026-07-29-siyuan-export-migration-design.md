# SiYuan Export Migration Design

**Date:** 2026-07-29  
**Status:** Approved  
**Version:** 0.1.0

## Goal

Replace the current SiYuan plugin sample behaviour with the existing SiYuan-to-Markdown export feature. The project keeps the current template's TypeScript, SCSS, i18n, linting, formatting, and Webpack packaging conventions, but ships no sample UI or sample kernel behaviour.

## Scope

The plugin is desktop-only (Windows, macOS, and Linux). It provides:

- a top-bar action and command-palette command that open an export dialog;
- persisted settings for the Python command, SiYuan workspace directory, and export directory;
- Python runtime validation;
- a bundled Python exporter that converts every notebook document to Markdown;
- live stdout/stderr output, export state, and actionable errors in the dialog;
- copied assets and rewritten Markdown asset links using the existing `root-rewrite` behaviour.

The existing Python renderer remains the source of truth for document conversion. Users may set a Python executable path or command; when empty, the plugin uses `python3` on macOS/Linux and `py -3` on Windows.

## Non-goals

- No mobile, browser, or Docker support.
- No rewrite of the exporter using the SiYuan kernel API.
- No sample Tab, Dock, menu, RPC/MCP, event-bus, or kernel-server demonstrations.
- No behavioural expansion beyond the old exporter (for example incremental export or notebook selection).

## Architecture

### Application plugin (`src/index.ts`)

`SiyuanExportPlugin` owns only the desktop UI and orchestration:

1. Load and merge persisted settings during `onload`.
2. Register an icon, command, and top-bar button.
3. Render the dialog and validate the selected Python runtime with a debounced probe.
4. Persist settings before export.
5. Spawn the bundled Python entry point with `--data-dir` and `--out-dir`.
6. Stream output into the dialog and surface a success or failure message.
7. Cancel timers and destroy the dialog during unload; delete plugin settings during uninstall.

The source is TypeScript and uses the SiYuan frontend API. Node desktop modules (`child_process`, `fs`, and `path`) are used only in the desktop plugin runtime.

### Export engine (`python/siyuan_export`)

The old `core.py` and package initializer are copied unchanged except for any path-neutral packaging adjustments. The engine:

1. reads document metadata from the workspace SQLite database;
2. loads `.sy` JSON documents;
3. renders supported block and inline nodes to Markdown;
4. writes files beneath notebook and document hierarchy paths;
5. copies global assets and rewrites their relative Markdown links;
6. reports exported, missing/failed, and conflict counts.

### Packaging

Production Webpack output remains `dist/index.js` and `dist/index.css`. The copy/zip configuration additionally includes `python/` in `dist/python/`, alongside `plugin.json`, i18n files, README files, icon, and preview image. The obsolete kernel entry/configuration is removed because it is sample-only and not used by the export plugin.

## Metadata and documentation

`plugin.json` changes from `plugin-sample` to `siyuan-export`, uses version `0.1.0`, and limits `backends` and `frontends` to desktop environments. English uses `en`; Simplified Chinese uses `zh-CN`. Package metadata and both README files describe the actual export feature and its Python requirement.

## Error handling and safety

- Empty workspace/export paths prevent export.
- An unavailable Python command prevents export and shows the probe result.
- A missing bundled script, child-process error, or non-zero exporter exit is reported in both the dialog log and SiYuan notification.
- The exporter opens the SQLite database read-only and only writes within the user-selected export directory.
- Existing Markdown files are overwritten, matching the old behaviour; filename collisions in one export are disambiguated by document ID.

## Verification

- Run formatter and ESLint without auto-fix.
- Run a production build and inspect `package.zip` to confirm the Python package and required plugin assets are present.
- Type-check the TypeScript source where the available runtime permits it.
- In a desktop SiYuan instance, verify the dialog opens, settings persist, a valid Python probe enables export, and a sample workspace produces Markdown plus accessible assets.
