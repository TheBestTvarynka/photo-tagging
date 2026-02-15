import {
    App,
    Editor,
    MarkdownView,
    Modal,
    Notice,
    Plugin,
    Menu,
    MenuItem,
    TFile,
    TAbstractFile,
} from 'obsidian';
import { DEFAULT_SETTINGS, PhotoTaggingSettings, SampleSettingTab } from './settings';

export default class PhotoTagging extends Plugin {
    settings: PhotoTaggingSettings;

    async onload() {
        await this.loadSettings();

        // This creates an icon in the left ribbon.
        this.addRibbonIcon('dice', 'Sample', (evt: MouseEvent) => {
            // Called when the user clicks the icon.
            new Notice('This is a notice!');
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SampleSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                this.handleFileMenu(menu, file);
            }),
        );

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {}

    handleFileMenu(menu: Menu, file: TAbstractFile) {
        console.log('Handle file menu');

        if (
            file.name.endsWith('.jpg') ||
            file.name.endsWith('.png') ||
            file.name.endsWith('.jpeg')
        ) {
            menu.addItem((item: MenuItem) => {
                item.setTitle('Tag people')
                    .setIcon('pin')
                    .onClick(async () => {
                        console.log('Tag people clicked');
                    });
            });
        }
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            (await this.loadData()) as Partial<PhotoTaggingSettings>,
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        let { contentEl } = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
