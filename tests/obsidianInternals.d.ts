import 'obsidian';

// The undocumented plugin manager the tests use to enable and reach the plugin.
declare module 'obsidian' {
    interface App {
        plugins: {
            plugins: Record<string, unknown>;
            isEnabled(): boolean;
            setEnable(enabled: boolean): Promise<void>;
            enablePluginAndSave(id: string): Promise<boolean>;
        };
    }
}
