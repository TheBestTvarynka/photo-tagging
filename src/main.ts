import { Plugin, Menu, MenuItem, TAbstractFile } from 'obsidian';

import { Tag, TaggerView, VIEW_TYPE } from './tagger';
import { DEFAULT_SETTINGS, PhotoTaggingSettings, PhotoRaggingSettingTab } from './settings';
import { mountPhotoList } from './photoList';

// Key is file path, value is list of tags.
type TagsDb = Map<string, Tag[]>;
// Key is the hashtag name and value is list of image paths.
type HashTagsDb = Map<string, string[]>;

type Db = {
    tags: TagsDb;
    hashTags: HashTagsDb;
};

type SerializedDb = {
    tags: Record<string, Tag[]>;
    hashTags: Record<string, string[]>;
};

export default class PhotoTagging extends Plugin {
    settings: PhotoTaggingSettings;
    tags: TagsDb;
    hashTags: HashTagsDb;

    async onload() {
        await this.loadSettings();

        try {
            if (!(await this.app.vault.adapter.exists(this.settings.databaseFile))) {
                await this.app.vault.adapter.write(
                    this.settings.databaseFile,
                    JSON.stringify({ tags: {}, hashTags: {} }),
                );
            }

            const data = await this.app.vault.adapter.read(this.settings.databaseFile);
            const parsed = JSON.parse(data) as Partial<SerializedDb>;
            this.tags = new Map(Object.entries(parsed.tags ?? {}));
            this.hashTags = new Map(Object.entries(parsed.hashTags ?? {}));
        } catch (error) {
            console.error('Error loading db:', error);
            this.tags = new Map();
            this.hashTags = new Map();
        }

        this.registerView(VIEW_TYPE, (leaf) => new TaggerView(leaf));

        this.addSettingTab(new PhotoRaggingSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                this.handleFileMenu(menu, file);
            }),
        );

        this.registerMarkdownCodeBlockProcessor('tagged-photos', (source, el, ctx) => {
            mountPhotoList(el, this.app, ctx, this.tags, this.hashTags, source);
        });
    }

    async activateView(file: TAbstractFile) {
        const tags = this.tags.get(file.path) || [];
        const setTags = (tags: Tag[]) => {
            this.tags.set(file.path, tags);
            this.saveDb().catch((err) => console.error(err));
        };

        // Collect hashtags currently attached to this image.
        const hashtags: string[] = [];
        for (const [name, paths] of this.hashTags.entries()) {
            if (paths.includes(file.path)) {
                hashtags.push(name);
            }
        }

        const setHashtags = (newHashtags: string[]) => {
            // Remove this image from all hashtags it was previously in.
            for (const [name, paths] of this.hashTags.entries()) {
                const filtered = paths.filter((p) => p !== file.path);
                if (filtered.length === 0) {
                    this.hashTags.delete(name);
                } else {
                    this.hashTags.set(name, filtered);
                }
            }
            // Add this image to each of the new hashtags.
            for (const ht of newHashtags) {
                const existing = this.hashTags.get(ht) || [];
                if (!existing.includes(file.path)) {
                    existing.push(file.path);
                }
                this.hashTags.set(ht, existing);
            }
            this.saveDb().catch((err) => console.error(err));
        };

        const allHashtagNames = Array.from(this.hashTags.keys());

        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true,
            state: {
                file,
                tags,
                setTags,
                hashtags,
                setHashtags,
                allHashtagNames,
            },
        });
    }

    async saveDb() {
        const db: SerializedDb = {
            tags: Object.fromEntries(this.tags),
            hashTags: Object.fromEntries(this.hashTags),
        };
        await this.app.vault.adapter.write(this.settings.databaseFile, JSON.stringify(db));
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
