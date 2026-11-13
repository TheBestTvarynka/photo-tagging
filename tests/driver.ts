import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Modifier, TFile } from 'obsidian';
import { evalInObsidian, TemporaryVault } from 'obsidian-integration-testing';
import { vi } from 'vitest';

import type { SerializedDb } from '../src/migrations';

// Helpers driving the plugin the way a user does. `evalInObsidian` serializes its
// callback, so selectors have to reach it through `input`, not through a closure.

const ACTIVE_LEAF = '.workspace-leaf.mod-active';

export const PERSON_INPUT = `${ACTIVE_LEAF} input[placeholder="Search page..."]`;
export const PERSON_LIST = `${ACTIVE_LEAF} .photo-tagging-search-results`;
export const HASHTAG_INPUT = `${ACTIVE_LEAF} .photo-tagging-hashtag-input input`;
export const HASHTAG_LIST = `${ACTIVE_LEAF} .photo-tagging-suggestions-dropdown`;
export const TAGGER_IMAGE = `${ACTIVE_LEAF} .photo-tagging-image`;
export const SELECTED_PERSON = `${ACTIVE_LEAF} .photo-tagging-selected-file`;
export const TAG_ITEM = `${ACTIVE_LEAF} .photo-tagging-tag-item`;
export const HASHTAG_CHIP = `${ACTIVE_LEAF} .photo-tagging-hashtag-link`;
// A note keeps its hidden editor view next to the reading view, and that one
// renders the block too.
export const GALLERY_IMAGE = `${ACTIVE_LEAF} .markdown-reading-view .pswp-gallery img`;
export const ACTIVE_TAB_HEADER = '.mod-root .workspace-tab-header.is-active';

export async function readDb(vault: TemporaryVault): Promise<SerializedDb> {
    const data = await readFile(join(vault.path, 'photo-tags.json'), 'utf-8');
    return JSON.parse(data) as SerializedDb;
}

// The plugin saves the db in the background, so `assertions` are retried until
// they pass. It also retries reading a file caught in the middle of a write.
export async function expectDb(
    vault: TemporaryVault,
    assertions: (db: SerializedDb) => void,
): Promise<void> {
    await vi.waitFor(
        async () => {
            assertions(await readDb(vault));
        },
        { timeout: 10_000, interval: 50 },
    );
}

export async function copyImage(vault: TemporaryVault, from: string, to: string): Promise<void> {
    await evalInObsidian({
        input: { from, to },
        callback: async ({ app, from, to }) => {
            const file = app.vault.getFileByPath(from);
            if (!file) {
                throw new Error(`File not found: ${from}`);
            }
            await app.vault.copy(file, to);
        },
        vaultPath: vault.path,
    });
}

export async function renameFile(vault: TemporaryVault, from: string, to: string): Promise<void> {
    await evalInObsidian({
        input: { from, to },
        callback: async ({ app, from, to }) => {
            const file = app.vault.getFileByPath(from);
            if (!file) {
                throw new Error(`File not found: ${from}`);
            }

            const folder = to.slice(0, to.lastIndexOf('/'));
            if (folder && !app.vault.getFolderByPath(folder)) {
                await app.vault.createFolder(folder);
            }
            await app.fileManager.renameFile(file, to);
        },
        vaultPath: vault.path,
    });
}

export async function deleteFile(vault: TemporaryVault, path: string): Promise<void> {
    await evalInObsidian({
        input: { path },
        callback: async ({ app, path }) => {
            const file = app.vault.getFileByPath(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- `FileManager.trashFile` may use the system trash, and test files have no place there.
            await app.vault.trash(file, false);
        },
        vaultPath: vault.path,
    });
}

// Opens the image in the tagger, in a new tab: reusing a tab would keep the
// component state of the image shown there before.
export async function openImageInTagger(vault: TemporaryVault, imagePath: string): Promise<void> {
    await evalInObsidian({
        input: { imagePath, imageSelector: TAGGER_IMAGE },
        callback: async ({ app, imagePath, imageSelector, lib: { waitUntil } }) => {
            const file = app.vault.getFileByPath(imagePath);
            if (!file) {
                throw new Error(`File not found: ${imagePath}`);
            }

            app.workspace.setActiveLeaf(app.workspace.getLeaf('tab'), { focus: true });

            const plugin = app.plugins.plugins['photo-tagging'] as {
                activateView: (file: TFile) => Promise<void>;
            };
            await plugin.activateView(file);

            await waitUntil({
                predicate: () => {
                    const image = document.querySelector<HTMLImageElement>(imageSelector);
                    return image !== null && image.complete && image.naturalWidth > 0;
                },
                message: 'Tagger image did not load',
            });
            // Loading the image moves the sidebar, and a click uses the element's
            // current coordinates, so let the layout settle first.
            await new Promise((resolve) => setTimeout(resolve, 500));
        },
        vaultPath: vault.path,
    });
}

export async function clickElement(vault: TemporaryVault, selector: string): Promise<void> {
    await evalInObsidian({
        input: { selector },
        callback: async ({ selector, lib: { clickElement } }) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            await clickElement({ element });
        },
        vaultPath: vault.path,
    });
}

export async function typeInto(
    vault: TemporaryVault,
    selector: string,
    text: string,
): Promise<void> {
    await evalInObsidian({
        input: { selector, text },
        callback: async ({ selector, text, lib: { clickElement, pressKey, waitUntil } }) => {
            const input = document.querySelector<HTMLInputElement>(selector);
            if (!input) {
                throw new Error(`Input not found: ${selector}`);
            }

            await clickElement({ element: input });
            await waitUntil({
                predicate: () => document.activeElement === input,
                message: `Input did not get focus: ${selector}`,
            });

            for (const key of text) {
                await pressKey({ key });
            }
            // Key presses arrive asynchronously.
            await waitUntil({
                predicate: () => input.value === text,
                message: `Input did not receive the text: ${text}`,
            });
        },
        vaultPath: vault.path,
    });
}

export async function pressKey(
    vault: TemporaryVault,
    key: string,
    modifiers: Modifier[] = [],
): Promise<void> {
    await evalInObsidian({
        input: { key, modifiers },
        callback: async ({ key, modifiers, lib: { pressKey } }) => {
            await pressKey({ key, modifiers });
        },
        vaultPath: vault.path,
    });
}

export type Suggestion = { label: string; isSelected: boolean };

export async function getSuggestions(
    vault: TemporaryVault,
    listSelector: string,
): Promise<Suggestion[]> {
    return evalInObsidian({
        input: { listSelector },
        callback: ({ listSelector }) =>
            Array.from(document.querySelectorAll(`${listSelector} [role="option"]`)).map(
                (option) => ({
                    label: option.textContent ?? '',
                    isSelected: option.getAttribute('aria-selected') === 'true',
                }),
            ),
        vaultPath: vault.path,
    });
}

export async function getTexts(vault: TemporaryVault, selector: string): Promise<string[]> {
    return evalInObsidian({
        input: { selector },
        callback: ({ selector }) =>
            Array.from(document.querySelectorAll(selector)).map(
                (element) => element.textContent ?? '',
            ),
        vaultPath: vault.path,
    });
}

// Whether `selector` matches the element holding the keyboard focus.
export async function isFocused(vault: TemporaryVault, selector: string): Promise<boolean> {
    return evalInObsidian({
        input: { selector },
        callback: ({ selector }) => {
            const element = document.querySelector(selector);
            return element !== null && element === document.activeElement;
        },
        vaultPath: vault.path,
    });
}

export async function getInputValue(vault: TemporaryVault, selector: string): Promise<string> {
    return evalInObsidian({
        input: { selector },
        callback: ({ selector }) => document.querySelector<HTMLInputElement>(selector)?.value ?? '',
        vaultPath: vault.path,
    });
}

// Right-clicks the element and returns the titles of the menu it opened. Closes the
// menu afterwards: a real one opens, and it would swallow the next test's input.
export async function getContextMenuTitles(
    vault: TemporaryVault,
    selector: string,
): Promise<string[]> {
    return evalInObsidian({
        input: { selector },
        callback: async ({ selector, lib: { clickElement, pressKey, waitUntil } }) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }

            await clickElement({ element, button: 'right' });
            await waitUntil({
                predicate: () => document.querySelector('.menu .menu-item-title') !== null,
                message: `Context menu did not open: ${selector}`,
            });

            const titles = Array.from(document.querySelectorAll('.menu .menu-item-title')).map(
                (title) => title.textContent ?? '',
            );

            await pressKey({ key: 'Escape' });
            await waitUntil({
                predicate: () => document.querySelector('.menu') === null,
                message: 'Context menu did not close',
            });

            return titles;
        },
        vaultPath: vault.path,
    });
}
