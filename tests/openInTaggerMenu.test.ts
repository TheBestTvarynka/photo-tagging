import { evalInObsidian, TemporaryVault } from 'obsidian-integration-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ACTIVE_TAB_HEADER, GALLERY_IMAGE, getContextMenuTitles } from './driver';
import { openTestVault } from './testVault';

const MENU_ITEM = 'Open in tagger';
const IMAGE_PATH = 'images/Clerk_Maxwell.png';

describe('open in tagger menu item', () => {
    let vault: TemporaryVault;

    beforeAll(async () => {
        vault = await openTestVault('open-in-tagger-menu');
    });

    afterAll(async () => {
        await vault?.dispose();
    });

    it('is shown for an image in the file explorer', async () => {
        const itemSelector = `.nav-file-title[data-path="${IMAGE_PATH}"]`;

        await evalInObsidian({
            input: { itemSelector },
            callback: async ({ app, itemSelector, lib: { clickElement, waitUntil } }) => {
                app.workspace.leftSplit.expand();

                if (!document.querySelector(itemSelector)) {
                    const folder = document.querySelector<HTMLElement>(
                        '.nav-folder-title[data-path="images"]',
                    );
                    if (!folder) {
                        throw new Error('Images folder not found in the file explorer');
                    }
                    await clickElement({ element: folder });
                }

                await waitUntil({
                    predicate: () => document.querySelector(itemSelector) !== null,
                    message: 'Image not found in the file explorer',
                });
            },
            vaultPath: vault.path,
        });

        expect(await getContextMenuTitles(vault, itemSelector)).toContain(MENU_ITEM);
    });

    it('is shown for the tab of an opened image', async () => {
        await evalInObsidian({
            input: { imagePath: IMAGE_PATH },
            callback: async ({ app, imagePath, lib: { waitUntil } }) => {
                const file = app.vault.getFileByPath(imagePath);
                if (!file) {
                    throw new Error(`File not found: ${imagePath}`);
                }

                await app.workspace.getLeaf('tab').openFile(file, { active: true });

                await waitUntil({
                    predicate: () => app.workspace.getActiveFile()?.path === imagePath,
                    message: 'Image was not opened',
                });
            },
            vaultPath: vault.path,
        });

        expect(await getContextMenuTitles(vault, ACTIVE_TAB_HEADER)).toContain(MENU_ITEM);
    });

    it('is shown for an image in the gallery', async () => {
        await evalInObsidian({
            input: { gallerySelector: GALLERY_IMAGE },
            callback: async ({ app, gallerySelector, lib: { waitUntil } }) => {
                const note = app.vault.getFileByPath('Clerk_Maxwell.md');
                if (!note) {
                    throw new Error('Test note not found');
                }

                await app.workspace
                    .getLeaf('tab')
                    .openFile(note, { active: true, state: { mode: 'preview' } });

                await waitUntil({
                    predicate: () => {
                        const image = document.querySelector<HTMLImageElement>(gallerySelector);
                        return image !== null && image.complete && image.naturalWidth > 0;
                    },
                    message: 'Gallery was not rendered',
                });
            },
            vaultPath: vault.path,
        });

        expect(await getContextMenuTitles(vault, GALLERY_IMAGE)).toContain(MENU_ITEM);
    });
});
