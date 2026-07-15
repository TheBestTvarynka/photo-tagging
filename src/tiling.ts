import { App, FileSystemAdapter, PluginManifest } from 'obsidian';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const TILE_SIZE = 256;
const PREVIEW_MAX_DIMENSION = 1024;

type TileMeta = {
    previewWidth: number;
    previewHeight: number;
};

export type ImageTiles = {
    // Vault-relative path to the `<name>_files` directory dzsave produced,
    // i.e. what a deepzoom tile URL template is rooted at.
    tileFilesVaultPath: string;
    previewVaultPath: string;
    previewWidth: number;
    previewHeight: number;
};

function getTileDirVaultPath(app: App, manifest: PluginManifest, imagePath: string): string {
    return `${app.vault.configDir}/plugins/${manifest.id}/tiles/${imagePath}`;
}

function getImageFileName(imagePath: string): string {
    return imagePath.slice(imagePath.lastIndexOf('/') + 1);
}

function loadImageSize(
    adapter: FileSystemAdapter,
    vaultRelativePath: string,
): Promise<{ width: number; height: number }> {
    const src = adapter.getResourcePath(vaultRelativePath);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () =>
            reject(new Error(`Failed to load generated preview: ${vaultRelativePath}`));
        img.src = src;
    });
}

// Generates a Deepzoom tile pyramid (via `vips dzsave`) plus a downsized
// preview image (via `vipsthumbnail`) for `imagePath`, if it hasn't been
// tiled yet. Assumes libvips is installed on the host system.
export async function ensureImageTiles(
    app: App,
    manifest: PluginManifest,
    imagePath: string,
): Promise<void> {
    const adapter = app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
        return;
    }

    const tileDirVaultPath = getTileDirVaultPath(app, manifest, imagePath);
    if (await adapter.exists(tileDirVaultPath)) {
        return;
    }

    const imageFileName = getImageFileName(imagePath);
    const tileDirAbsPath = adapter.getFullPath(tileDirVaultPath);
    const imageAbsPath = adapter.getFullPath(imagePath);

    try {
        await fs.mkdir(tileDirAbsPath, { recursive: true });

        await execFileAsync('vips', [
            'dzsave',
            imageAbsPath,
            `${tileDirAbsPath}/${imageFileName}`,
            '--layout',
            'dz',
            '--tile-size',
            String(TILE_SIZE),
            '--overlap',
            '0',
            '--suffix',
            '.jpg[Q=85]',
        ]);

        const previewVaultPath = `${tileDirVaultPath}/preview.jpg`;
        await execFileAsync('vipsthumbnail', [
            imageAbsPath,
            `--size=${PREVIEW_MAX_DIMENSION}x${PREVIEW_MAX_DIMENSION}`,
            '-o',
            `${tileDirAbsPath}/preview.jpg[Q=85]`,
        ]);

        const { width, height } = await loadImageSize(adapter, previewVaultPath);
        const meta: TileMeta = { previewWidth: width, previewHeight: height };
        await adapter.write(`${tileDirVaultPath}/meta.json`, JSON.stringify(meta));
    } catch (error) {
        // Remove partial output so the next attempt regenerates from scratch
        // instead of treating a half-written directory as "already tiled".
        await adapter.rmdir(tileDirVaultPath, true).catch(() => {});
        throw error;
    }
}

// Read-only lookup used by the gallery: returns tile info if `imagePath`
// has already been tiled (via `ensureImageTiles`), otherwise null.
export async function readImageTiles(
    app: App,
    manifest: PluginManifest,
    imagePath: string,
): Promise<ImageTiles | null> {
    const adapter = app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
        return null;
    }

    const tileDirVaultPath = getTileDirVaultPath(app, manifest, imagePath);
    const metaVaultPath = `${tileDirVaultPath}/meta.json`;

    if (!(await adapter.exists(metaVaultPath))) {
        return null;
    }

    try {
        const meta = JSON.parse(await adapter.read(metaVaultPath)) as TileMeta;
        return {
            tileFilesVaultPath: `${tileDirVaultPath}/${getImageFileName(imagePath)}_files`,
            previewVaultPath: `${tileDirVaultPath}/preview.jpg`,
            previewWidth: meta.previewWidth,
            previewHeight: meta.previewHeight,
        };
    } catch {
        return null;
    }
}
