import { App, TFile } from 'obsidian';

import { ImagePath, Tag } from './tagger';

export const CURRENT_DB_VERSION = 1;

// The stored JSON file scheme.
export type SerializedDb = {
    version: number;
    tags: Record<string, Tag[]>;
    hashTags: Record<string, ImagePath[]>;
};

// Pre-1 scheme: no `version` field and `hashTags` values are plain image paths.
type SerializedDbV0 = {
    tags: Record<string, Tag[]>;
    hashTags: Record<string, string[]>;
};

async function getImageDimensions(
    app: App,
    path: string,
): Promise<{ width: number; height: number }> {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
        return { width: 0, height: 0 };
    }

    const src = app.vault.getResourcePath(file);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = src;
    });
}

// Adds the `version` field and turns each hashtag's image paths into
// `ImagePath` objects carrying that image's width/height.
async function migrateV0ToV1(app: App, db: SerializedDbV0): Promise<SerializedDb> {
    const hashTags: Record<string, ImagePath[]> = {};

    for (const [name, paths] of Object.entries(db.hashTags)) {
        const imagePaths: ImagePath[] = [];
        for (const path of paths) {
            const { width, height } = await getImageDimensions(app, path);
            imagePaths.push({ path, imageWidth: width, imageHeight: height });
        }
        hashTags[name] = imagePaths;
    }

    return { version: 1, tags: db.tags, hashTags };
}

// Brings a freshly-parsed db of any (unknown) version up to `CURRENT_DB_VERSION`.
export async function migrateDb(app: App, raw: unknown): Promise<[SerializedDb, boolean]> {
    const parsed = (raw ?? {}) as Partial<SerializedDb> & Partial<SerializedDbV0>;

    if (parsed.version === undefined) {
        return [
            await migrateV0ToV1(app, {
                tags: parsed.tags ?? {},
                hashTags: (parsed.hashTags as Record<string, string[]>) ?? {},
            }),
            true,
        ];
    }

    if (parsed.version !== CURRENT_DB_VERSION) {
        throw new Error(`invalid JSON scheme version: ${parsed.version}`);
    }

    return [parsed as SerializedDb, false];
}
