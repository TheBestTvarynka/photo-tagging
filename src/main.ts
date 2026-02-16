import { Notice, Plugin, Menu, MenuItem, TAbstractFile, TFile } from 'obsidian';

import { Tag, TaggerView, VIEW_TYPE } from './tagger';
import { DEFAULT_SETTINGS, PhotoTaggingSettings, PhotoRaggingSettingTab } from './settings';

// Key is file path, value is list of tags.
type TagsDb = Map<string, Tag[]>;

export default class PhotoTagging extends Plugin {
    settings: PhotoTaggingSettings;
    tags: TagsDb;

    async onload() {
        await this.loadSettings();

        try {
            if (!(await this.app.vault.adapter.exists(this.settings.databaseFile))) {
                await this.app.vault.adapter.write(this.settings.databaseFile, '{}');
            }

            const data = await this.app.vault.adapter.read(this.settings.databaseFile);
            this.tags = new Map(Object.entries(JSON.parse(data) as Record<string, Tag[]>));
        } catch (error) {
            console.error('Error loading tags:', error);
            this.tags = new Map();
        }

        this.addRibbonIcon('dice', 'Sample', (_evt: MouseEvent) => {
            new Notice('This is a notice!');
        });

        this.registerView(VIEW_TYPE, (leaf) => new TaggerView(leaf));

        this.addSettingTab(new PhotoRaggingSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                this.handleFileMenu(menu, file);
            }),
        );

        this.registerMarkdownCodeBlockProcessor('tagged-photos', (source, el, ctx) => {
            const currentFile = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
            if (!(currentFile instanceof TFile)) {
                return;
            }

            const photos: string[] = [];

            for (const [imagePath, fileTags] of this.tags.entries()) {
                const isTagged = fileTags.some((tag) => tag.filePath === currentFile.path);
                if (isTagged) {
                    photos.push(imagePath);
                }
            }

            const ul = el.createEl('ul');
            photos.forEach((photoPath) => {
                const li = ul.createEl('li');
                const a = li.createEl('a');
                a.innerText = photoPath;
                a.href = '#';
                a.onclick = (e) => {
                    e.preventDefault();
                    this.app.workspace.openLinkText(photoPath, '', true);
                };
            });
        });
    }

    async activateView(file: TAbstractFile) {
        const tags = this.tags.get(file.path) || [];
        const setTags = (tags: Tag[]) => {
            this.tags.set(file.path, tags);
            this.saveTags().catch((err) => console.error(err));
        };

        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true,
            state: {
                file,
                tags,
                setTags,
            },
        });
    }

    async saveTags() {
        const obj = Object.fromEntries(this.tags);
        await this.app.vault.adapter.write(this.settings.databaseFile, JSON.stringify(obj));
    }

    onunload() {}

    handleFileMenu(menu: Menu, file: TAbstractFile) {
        if (
            file.name.endsWith('.jpg') ||
            file.name.endsWith('.png') ||
            file.name.endsWith('.jpeg')
        ) {
            menu.addItem((item: MenuItem) => {
                item.setTitle('Tag people')
                    .setIcon('pin')
                    .onClick(async () => {
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
