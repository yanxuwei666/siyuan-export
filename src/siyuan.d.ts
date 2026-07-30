declare module "siyuan" {
    export interface DialogOptions {
        title: string;
        content: string;
        width?: string;
        height?: string;
    }

    export class Dialog {
        element: HTMLElement;
        constructor(options: DialogOptions);
        destroy(): void;
    }

    export class Plugin {
        name: string;
        i18n: unknown;
        app: unknown;
        addIcons(svg: string): void;
        addCommand(options: {langKey: string; hotkey?: string; callback: () => void;}): void;
        addTopBar(options: {icon: string; title: string; position: "right" | "left"; callback: () => void;}): void;
        loadData(key: string): Promise<unknown>;
        saveData(key: string, value: unknown): Promise<void>;
        removeData(key: string): Promise<void>;
    }

    export function showMessage(message: string): void;
    export function fetchSyncPost(url: string, data?: unknown): Promise<unknown>;
}
