import { App, PluginSettingTab, Setting } from 'obsidian';
import PhotoTagging from './main';

export interface PhotoTaggingSettings {
    databaseFile: string;
}

export const DEFAULT_SETTINGS: PhotoTaggingSettings = {
    databaseFile: 'photo-tags.json',
};

export class PhotoRaggingSettingTab extends PluginSettingTab {
    plugin: PhotoTagging;

    constructor(app: App, plugin: PhotoTagging) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Database file')
            .setDesc('File path.')
            .addText((text) =>
                text
                    .setPlaceholder('Enter your secret')
                    .setValue(this.plugin.settings.databaseFile)
                    .onChange(async (value) => {
                        this.plugin.settings.databaseFile = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
