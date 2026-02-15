import { Notice, Plugin, Menu, MenuItem, TAbstractFile } from 'obsidian';

import { TaggerView, VIEW_TYPE } from './tagger';
import { DEFAULT_SETTINGS, PhotoTaggingSettings, SampleSettingTab } from './settings';

export default class PhotoTagging extends Plugin {
    settings: PhotoTaggingSettings;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('dice', 'Sample', (_evt: MouseEvent) => {
            new Notice('This is a notice!');
        });

        this.registerView(VIEW_TYPE, (leaf) => new TaggerView(leaf));

        this.addSettingTab(new SampleSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                this.handleFileMenu(menu, file);
            }),
        );
    }

    async activateView(file: TAbstractFile) {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true,
            state: {
                file,
            },
        });
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
                        this.activateView(file).catch((err) => console.error(err));
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
