import { Plugin, Menu, MenuItem, Notice, TAbstractFile, TFile } from 'obsidian';

import { ImagePath, Tag, TaggerView, VIEW_TYPE } from './tagger';
import { DEFAULT_SETTINGS, PhotoTaggingSettings, PhotoRaggingSettingTab } from './settings';
import { mountPhotoList } from './photoList';
import { CURRENT_DB_VERSION, migrateDb, SerializedDb } from './migrations';
import { ensureImageTiles } from './tiling';

// Key is file path, value is list of tags.
type TagsDb = Map<string, Tag[]>;
// Key is the hashtag name and value is list of image paths.
type HashTagsDb = Map<string, ImagePath[]>;

export default class PhotoTagging extends Plugin {
    settings: PhotoTaggingSettings;
    tags: TagsDb;
    hashTags: HashTagsDb;

    async onload() {
        await this.loadSettings();

        try {
            if (!(await this.app.vault.adapter.exists(this.settings.databaseFile))) {
                const emptyDb: SerializedDb = {
                    version: CURRENT_DB_VERSION,
                    tags: {},
                    hashTags: {},
                };
                await this.app.vault.adapter.write(
                    this.settings.databaseFile,
                    JSON.stringify(emptyDb),
                );
            }

            const data = await this.app.vault.adapter.read(this.settings.databaseFile);
            const parsed = JSON.parse(data) as unknown;
            const [db, wasMigrated] = await migrateDb(this.app, parsed);

            this.tags = new Map(Object.entries(db.tags ?? {}));
            this.hashTags = new Map(Object.entries(db.hashTags ?? {}));

            if (wasMigrated) {
                await this.saveDb();
            }
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

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                this.handleFileRename(file.path, oldPath);
            }),
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                this.handleFileDelete(file.path);
            }),
        );

        this.registerMarkdownCodeBlockProcessor('tagged-photos', (source, el, ctx) => {
            mountPhotoList(el, this.app, this.manifest, ctx, this.tags, this.hashTags, source);
        });

        this.addCommand({
            id: 'generate-deep-zoom-tiles',
            name: 'Generate deep-zoom tiles for all tagged photos',
            callback: () => {
                this.generateAllTiles().catch((err) => console.error(err));
            },
        });
    }

    // Backfills deep-zoom tiles for every image referenced in the db, for
    // vaults tagged before deep zoom was introduced. Skips images that
    // already have tiles (see `ensureImageTiles`).
    async generateAllTiles() {
        const imagePaths = new Set<string>();
        for (const path of this.tags.keys()) {
            imagePaths.add(path);
        }
        for (const paths of this.hashTags.values()) {
            for (const { path } of paths) {
                imagePaths.add(path);
            }
        }

        const paths = Array.from(imagePaths);
        if (paths.length === 0) {
            new Notice('No tagged photos found.');
            return;
        }

        const progress = new Notice(`Generating deep-zoom tiles: 0 / ${paths.length}`, 0);

        let done = 0;
        let failed = 0;
        let skipped = 0;

        for (const [index, path] of paths.entries()) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) {
                skipped++;
            } else {
                try {
                    await ensureImageTiles(this.app, this.manifest, path);
                    done++;
                } catch (error) {
                    failed++;
                    console.error(`Error generating deep-zoom tiles for ${path}:`, error);
                }
            }

            progress.setMessage(`Generating deep-zoom tiles: ${index + 1} / ${paths.length}`);
        }

        progress.hide();
        new Notice(
            `Deep-zoom tiling complete: ${done} ready, ${failed} failed, ${skipped} missing files.`,
        );
    }

    async activateView(file: TAbstractFile) {
        try {
            await ensureImageTiles(this.app, this.manifest, file.path);
        } catch (error) {
            console.error('Error generating deep-zoom tiles:', error);
            new Notice(
                `Failed to generate deep-zoom tiles for ${file.name}. See console for details.`,
            );
        }

        const tags = this.tags.get(file.path) || [];
        const setTags = (tags: Tag[]) => {
            this.tags.set(file.path, tags);
            this.saveDb().catch((err) => console.error(err));
        };

        // Collect hashtags currently attached to this image.
        const hashtags: string[] = [];
        for (const [name, paths] of this.hashTags.entries()) {
            if (paths.some((imagePath) => imagePath.path === file.path)) {
                hashtags.push(name);
            }
        }

        const setHashtags = (newHashtags: string[], imageWidth: number, imageHeight: number) => {
            // Yes, at this point it would be easier to use SQLite, but I think
            // the project is not big enough to use it (at least yet).

            // Remove this image from all hashtags it was previously in.
            for (const [name, paths] of this.hashTags.entries()) {
                const filtered = paths.filter((imagePath) => imagePath.path !== file.path);

                this.hashTags.set(name, filtered);
            }

            // Add this image to each of the new hashtags.
            for (const hashtag of newHashtags) {
                const existing = this.hashTags.get(hashtag) || [];
                if (!existing.some((imagePath) => imagePath.path === file.path)) {
                    existing.push({ path: file.path, imageWidth, imageHeight });

                    this.hashTags.set(hashtag, existing);
                }
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
            version: CURRENT_DB_VERSION,
            tags: Object.fromEntries(this.tags),
            hashTags: Object.fromEntries(this.hashTags),
        };
        await this.app.vault.adapter.write(this.settings.databaseFile, JSON.stringify(db));
    }

    // A renamed/moved file may be a tagged image (key in `tags`, referenced in
    // `hashTags`) or a person note (`filePath` inside some tag). Update every
    // place that references the old path so the db never points at a dead path.
    handleFileRename(newPath: string, oldPath: string) {
        let changed = false;

        if (this.tags.has(oldPath)) {
            const tags = this.tags.get(oldPath)!;
            this.tags.delete(oldPath);
            this.tags.set(newPath, tags);
            changed = true;
        }

        for (const [, paths] of this.hashTags.entries()) {
            const imagePath = paths.find((p) => p.path === oldPath);
            if (imagePath) {
                imagePath.path = newPath;
                changed = true;
            }
        }

        for (const tags of this.tags.values()) {
            for (const tag of tags) {
                if (tag.filePath === oldPath) {
                    tag.filePath = newPath;
                    changed = true;
                }
            }
        }

        if (changed) {
            this.saveDb().catch((err) => console.error(err));
        }
    }

    handleFileDelete(path: string) {
        // A deleted file may be a tagged image or a person note (see `.handleFileRename`).
        // Since the path no longer exists, drop every reference to it.
        let changed = false;

        if (this.tags.delete(path)) {
            changed = true;
        }

        for (const [hashtagName, paths] of this.hashTags.entries()) {
            const filtered = paths.filter((p) => p.path !== path);
            if (filtered.length !== paths.length) {
                this.hashTags.set(hashtagName, filtered);
                changed = true;
            }
        }

        for (const [imagePath, tags] of this.tags.entries()) {
            const filtered = tags.filter((tag) => tag.filePath !== path);
            if (filtered.length !== tags.length) {
                this.tags.set(imagePath, filtered);
                changed = true;
            }
        }

        if (changed) {
            this.saveDb().catch((err) => console.error(err));
        }
    }

    onunload() {}

    handleFileMenu(menu: Menu, file: TAbstractFile) {
        if (
            file.name.endsWith('.jpg') ||
            file.name.endsWith('.png') ||
            file.name.endsWith('.jpeg')
        ) {
            menu.addItem((item: MenuItem) => {
                item.setTitle('Open in tagger')
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
