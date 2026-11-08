import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { TFile } from 'obsidian';
import { evalInObsidian, TemporaryVault } from 'obsidian-integration-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openTestVault } from './testVault';

describe('hashtag note', () => {
    let vault: TemporaryVault;

    beforeAll(async () => {
        vault = await openTestVault('hashtag-note');
    });

    afterAll(async () => {
        await vault?.dispose();
    });

    it('opens a new note with the block when a hashtag is selected in the tagger', async () => {
        const hashtag = randomBytes(6).toString('hex');
        const notePath = `tag-${hashtag}.md`;

        await evalInObsidian({
            input: { hashtag },
            callback: async ({ app, hashtag, lib: { clickElement, pressKey, waitUntil } }) => {
                const file = app.vault.getFileByPath('images/Clerk_Maxwell.png');
                if (!file) {
                    throw new Error('Test image not found');
                }

                const plugin = app.plugins.plugins['photo-tagging'] as {
                    activateView: (file: TFile) => Promise<void>;
                };
                await plugin.activateView(file);

                const leafSelector = '.workspace-leaf.mod-active';
                await waitUntil({
                    predicate: () => {
                        const image = document.querySelector<HTMLImageElement>(
                            `${leafSelector} .photo-tagging-image`,
                        );
                        return image !== null && image.complete && image.naturalWidth > 0;
                    },
                    message: 'Tagger image did not load',
                });
                // Loading the image moves the sidebar, and a click uses the element's
                // current coordinates, so let the layout settle first.
                await new Promise((resolve) => setTimeout(resolve, 500));

                const input = document.querySelector<HTMLInputElement>(
                    `${leafSelector} .photo-tagging-hashtag-input input`,
                );
                if (!input) {
                    throw new Error('Tagger hashtag input not found');
                }

                await clickElement({ element: input });
                await waitUntil({
                    predicate: () => document.activeElement === input,
                    message: 'Hashtag input did not get focus',
                });

                for (const key of hashtag) {
                    await pressKey({ key });
                }
                // Key presses arrive asynchronously, and the create row already shows
                // after the first one. Enter must not commit a partial hashtag.
                await waitUntil({
                    predicate: () =>
                        input.value === hashtag &&
                        document.querySelector(`${leafSelector} .photo-tagging-suggestion-create`)
                            ?.textContent === `Create «${hashtag}»`,
                    message: 'Create hashtag row did not appear',
                });
                await pressKey({ key: 'Enter' });

                await waitUntil({
                    predicate: () =>
                        Array.from(
                            document.querySelectorAll(
                                `${leafSelector} .photo-tagging-hashtag-link`,
                            ),
                        ).some((chip) => chip.textContent === `#${hashtag}`),
                    message: 'Hashtag chip did not appear',
                });
            },
            vaultPath: vault.path,
        });

        const result = await evalInObsidian({
            input: { hashtag, notePath },
            callback: async ({ app, hashtag, notePath, lib: { clickElement, waitUntil } }) => {
                const countTabs = () => {
                    let count = 0;
                    app.workspace.iterateRootLeaves(() => {
                        count++;
                    });
                    return count;
                };

                const tabsBefore = countTabs();
                const leafBefore = app.workspace.getMostRecentLeaf();

                const chip = Array.from(
                    document.querySelectorAll<HTMLElement>(
                        '.workspace-leaf.mod-active .photo-tagging-hashtag-link',
                    ),
                ).find((element) => element.textContent === `#${hashtag}`);
                if (!chip) {
                    throw new Error(`Chip for #${hashtag} not found`);
                }
                await clickElement({ element: chip });

                await waitUntil({
                    predicate: () => app.workspace.getActiveFile()?.path === notePath,
                    message: 'Hashtag note was not opened',
                });

                // A note keeps its hidden editor view next to the reading view, and that
                // one renders the block too.
                const gallerySelector =
                    '.workspace-leaf.mod-active .markdown-reading-view .pswp-gallery img';
                await waitUntil({
                    predicate: () => document.querySelector(gallerySelector) !== null,
                    message: 'Gallery was not rendered',
                });

                return {
                    tabsBefore,
                    tabsAfter: countTabs(),
                    isNewLeaf: app.workspace.getMostRecentLeaf() !== leafBefore,
                    activeFilePath: app.workspace.getActiveFile()?.path,
                    photoCount: document.querySelectorAll(gallerySelector).length,
                };
            },
            vaultPath: vault.path,
        });

        expect(result.tabsAfter).toBe(result.tabsBefore + 1);
        expect(result.isNewLeaf).toBe(true);
        expect(result.activeFilePath).toBe(notePath);
        expect(result.photoCount).toBe(1);

        const content = await readFile(join(vault.path, notePath), 'utf-8');
        expect(content).toBe(`\`\`\`tagged-photos\nhashtag: ${hashtag}\n\`\`\`\n`);
    });
});
