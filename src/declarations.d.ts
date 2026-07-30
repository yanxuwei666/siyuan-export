declare module "*.scss" {
    const content: Record<string, string>;
    export default content;
}

declare module "*.py" {
    const content: string;
    export default content;
}

declare module "child_process" {
    interface ChildProcess {
        stdout: {on(event: "data", listener: (chunk: {toString(): string;}) => void): void;};
        stderr: {on(event: "data", listener: (chunk: {toString(): string;}) => void): void;};
        stdin: {end(data: string): void;};
        on(event: "error", listener: (error: Error) => void): void;
        on(event: "close", listener: (code: number | null) => void): void;
    }

    export function spawn(
        command: string,
        args: string[],
        options: {cwd?: string; env?: Record<string, string | undefined>; windowsHide: boolean;},
    ): ChildProcess;
    export function spawnSync(
        command: string,
        args: string[],
        options: {encoding: string; windowsHide: boolean;},
    ): {stdout?: string; stderr?: string; error?: Error; status: number | null;};
}

declare module "path" {
    export function resolve(...paths: string[]): string;
    export function basename(filePath: string): string;
    export function join(...paths: string[]): string;
    export function dirname(filePath: string): string;
}

declare const process: {
    platform: string;
    env: Record<string, string | undefined>;
};
