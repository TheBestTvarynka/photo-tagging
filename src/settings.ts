import { App, PluginSettingTab, Setting } from 'obsidian';
import PhotoTagging from './main';

export interface PhotoTaggingSettings {
    mySetting: string;
}

export const DEFAULT_SETTINGS: PhotoTaggingSettings = {
    mySetting: 'default',
};

export class SampleSettingTab extends PluginSettingTab {
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
            .setDesc('file path')
            .addText((text) =>
                text
                    .setPlaceholder('Enter your secret')
                    .setValue(this.plugin.settings.mySetting)
                    .onChange(async (value) => {
                        this.plugin.settings.mySetting = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
