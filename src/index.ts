import {
    spawn,
    spawnSync,
} from "child_process";
import {
    Dialog,
    fetchSyncPost,
    Plugin,
    showMessage,
} from "siyuan";
import "./index.scss";
import pythonExporter from "../python/siyuan_export/core.py";

const DATA_KEY = "siyuan-export-config";
const DEFAULT_PYTHON_COMMAND = process.platform === "win32" ?
    "py" :
    process.platform === "darwin" ?
    "/usr/bin/python3" :
    "python3";
const ASSET_LINK_RE = /\]\((assets\/[^)]+)\)/g;

interface ExportSettings {
    pythonCommand: string;
    outDir: string;
}
interface CommandProbe {
    command: string;
    available: boolean;
    output: string;
}
interface DocRow {
    id: string;
    box: string;
    hpath: string;
}
interface ExportDocument {
    id: string;
    hpath: string;
    notebookName: string;
    markdown: string;
}
interface ExportAsset {
    path: string;
    base64: string;
}
interface ApiResponse<T> {
    code: number;
    msg: string;
    data: T;
}

const DEFAULT_SETTINGS: ExportSettings = {pythonCommand: "", outDir: ""};

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(
        /'/g,
        "&#39;",
    );
}
function appendLog(textarea: HTMLTextAreaElement, text: string): void {
    textarea.value += text;
    textarea.scrollTop = textarea.scrollHeight;
}
function query<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing dialog element: ${selector}`);
    return element;
}
function toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}
function apiData<T>(response: unknown): T {
    const payload = response as ApiResponse<T>;
    if (!payload || payload.code !== 0) throw new Error(payload?.msg || "SiYuan API request failed");
    return payload.data;
}

export default class SiyuanExportPlugin extends Plugin {
    private dialog: Dialog | null = null;
    private config: ExportSettings = {...DEFAULT_SETTINGS};
    private probeTimer: ReturnType<typeof setTimeout> | null = null;
    private commandProbe: CommandProbe = {command: "", available: false, output: ""};

    async onload(): Promise<void> {
        const stored = await this.loadData(DATA_KEY).catch((): null => null) as Partial<ExportSettings> | null;
        this.config = {...DEFAULT_SETTINGS, ...stored};
        this.addIcons(
            '<symbol id="iconNotebookExport" viewBox="0 0 32 32"><path d="M6 4h14a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 5v2h10V9H8zm0 5v2h10v-2H8zm0 5v2h7v-2H8z"></path><path d="M24 10v4h-3l5 6 5-6h-3v-4h-4z"></path></symbol>',
        );
        this.addCommand({langKey: "openExportDialog", hotkey: "⇧⌘E", callback: () => this.openDialog()});
    }

    onLayoutReady(): void {
        this.addTopBar({
            icon: "iconNotebookExport",
            title: this.text("openExportDialog"),
            position: "right",
            callback: () => this.openDialog(),
        });
    }
    onunload(): void {
        if (this.probeTimer) clearTimeout(this.probeTimer);
        this.dialog?.destroy();
        this.dialog = null;
    }
    uninstall(): void {
        this.removeData(DATA_KEY).catch((): void => undefined);
    }

    private text(key: string): string {
        return (this.i18n as Record<string, string>)[key] ?? key;
    }
    private runtime(value: string): {command: string; args: string[];} {
        const command = value.trim() || DEFAULT_PYTHON_COMMAND;
        return {command, args: process.platform === "win32" && command.toLowerCase() === "py" ? ["-3"] : []};
    }
    private probe(value: string): CommandProbe {
        const runtime = this.runtime(value);
        const result = spawnSync(runtime.command, [...runtime.args, "--version"], {
            encoding: "utf8",
            windowsHide: true,
        });
        const available = !result.error && result.status === 0;
        return {
            command: runtime.command,
            available,
            output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() ||
                this.text(available ? "commandReady" : "commandMissing"),
        };
    }
    private html(): string {
        return `<div class="siyuan-export-plugin"><section class="siyuan-export-plugin__card"><label class="siyuan-export-plugin__field"><span class="siyuan-export-plugin__field-label"><span>${
            escapeHtml(this.text("pythonRuntime"))
        }</span><span class="siyuan-export-plugin__hint" data-role="hint"></span><span class="siyuan-export-plugin__actions"><button class="b3-button b3-button--outline" data-action="save">${
            escapeHtml(this.text("saveSettings"))
        }</button><button class="b3-button b3-button--text" data-action="export">${
            escapeHtml(this.text("exportNow"))
        }</button></span></span><input data-field="python" type="text" placeholder="${
            escapeHtml(this.text("pythonPlaceholder"))
        }"></label><label class="siyuan-export-plugin__field"><span class="siyuan-export-plugin__field-label">${
            escapeHtml(this.text("outDir"))
        }</span><input data-field="out" type="text" placeholder="/path/to/export"></label></section><section class="siyuan-export-plugin__card siyuan-export-plugin__card--log"><h2>${
            escapeHtml(this.text("logTitle"))
        }</h2><textarea class="siyuan-export-plugin__log" data-role="log" readonly></textarea></section></div>`;
    }
    private openDialog(): void {
        this.dialog?.destroy();
        this.dialog = new Dialog({
            title: this.text("title"),
            content: '<div class="siyuan-export-plugin__dialog-host"></div>',
            width: "780px",
            height: "620px",
        });
        const root = query<HTMLElement>(this.dialog.element, ".siyuan-export-plugin__dialog-host");
        root.innerHTML = this.html();
        const python = query<HTMLInputElement>(root, '[data-field="python"]');
        const out = query<HTMLInputElement>(root, '[data-field="out"]');
        const hint = query<HTMLElement>(root, '[data-role="hint"]');
        const log = query<HTMLTextAreaElement>(root, '[data-role="log"]');
        const exportButton = query<HTMLButtonElement>(root, '[data-action="export"]');
        python.value = this.config.pythonCommand;
        out.value = this.config.outDir;
        const refresh = (): void => {
            this.commandProbe = this.probe(python.value);
            hint.textContent = `(${
                this.commandProbe.available ? this.text("commandReady") : this.text("commandMissingHint")
            } · ${this.commandProbe.output})`;
            exportButton.disabled = !this.commandProbe.available || !out.value.trim();
        };
        python.addEventListener("input", () => {
            if (this.probeTimer) clearTimeout(this.probeTimer);
            this.probeTimer = setTimeout(refresh, 250);
        });
        out.addEventListener("input", refresh);
        refresh();
        query<HTMLButtonElement>(root, '[data-action="save"]').addEventListener(
            "click",
            () => this.save({pythonCommand: python.value.trim(), outDir: out.value.trim()}),
        );
        exportButton.addEventListener(
            "click",
            () =>
                this.export(
                    {pythonCommand: python.value.trim(), outDir: out.value.trim()},
                    log,
                    exportButton,
                    refresh,
                ),
        );
    }
    private async save(config: ExportSettings): Promise<void> {
        this.config = config;
        await this.saveData(DATA_KEY, config);
        showMessage(this.text("statusSaved"));
    }
    private async apiPayload(log: HTMLTextAreaElement): Promise<{documents: ExportDocument[]; assets: ExportAsset[];}> {
        const rows = apiData<DocRow[]>(
            await fetchSyncPost("/api/query/sql", {
                stmt: "SELECT id, box, hpath FROM blocks WHERE type = 'd' ORDER BY box, hpath",
            }),
        );
        const notebooks = apiData<{
            notebooks?: Array<{id: string; name: string;}>;
        }>(await fetchSyncPost("/api/notebook/lsNotebooks", {}));
        const names = new Map((notebooks.notebooks ?? []).map(item => [item.id, item.name]));
        const assets = new Set<string>();
        const documents: ExportDocument[] = [];
        for (const row of rows) {
            const data = apiData<{
                hPath: string;
                content: string;
            }>(await fetchSyncPost("/api/export/exportMdContent", {id: row.id}));
            let match: RegExpExecArray | null;
            while ((match = ASSET_LINK_RE.exec(data.content)) !== null) assets.add(match[1]);
            ASSET_LINK_RE.lastIndex = 0;
            documents.push({
                id: row.id,
                hpath: data.hPath || row.hpath,
                notebookName: names.get(row.box) ?? row.box,
                markdown: data.content,
            });
            appendLog(log, `[INFO] exported source: ${row.hpath}\n`);
        }
        const files: ExportAsset[] = [];
        for (const asset of assets) {
            const response = await fetch("/api/file/getFile", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({path: `/data/${asset}`}),
            });
            if (!response.ok) throw new Error(`Unable to read asset: ${asset}`);
            files.push({path: asset, base64: toBase64(await response.arrayBuffer())});
        }
        return {documents, assets: files};
    }
    private async export(
        config: ExportSettings,
        log: HTMLTextAreaElement,
        button: HTMLButtonElement,
        refresh: () => void,
    ): Promise<void> {
        if (!config.outDir) {
            showMessage(this.text("fillRequired"));
            return;
        }
        const probe = this.probe(config.pythonCommand);
        if (!probe.available) {
            showMessage(this.text("commandMissingHint"));
            return;
        }
        try {
            await this.save(config);
            button.disabled = true;
            appendLog(log, "[INFO] Reading documents through the SiYuan API...\n");
            const payload = await this.apiPayload(log);
            const runtime = this.runtime(config.pythonCommand);
            await new Promise<void>((resolve, reject) => {
                const child = spawn(runtime.command, [...runtime.args, "-u", "-c", pythonExporter, "--api-input"], {
                    windowsHide: true,
                });
                child.stdout.on("data", chunk => appendLog(log, chunk.toString()));
                child.stderr.on("data", chunk => appendLog(log, chunk.toString()));
                child.on(
                    "error",
                    error => reject(new Error(`Unable to start Python command "${runtime.command}": ${error.message}`)),
                );
                child.on("close", code => code === 0 ? resolve() : reject(new Error(`Exporter exited with ${code}`)));
                child.stdin.end(JSON.stringify({outDir: config.outDir, ...payload}));
            });
            showMessage(this.text("statusSuccess"));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            appendLog(log, `[ERROR] ${message}\n`);
            showMessage(message);
        } finally {
            refresh();
        }
    }
}
