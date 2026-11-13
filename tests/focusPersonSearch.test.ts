import { TemporaryVault } from 'obsidian-integration-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    copyImage,
    getInputValue,
    getSuggestions,
    getTexts,
    HASHTAG_INPUT,
    isFocused,
    openImageInTagger,
    PERSON_INPUT,
    PERSON_LIST,
    pressKey,
    SELECTED_PERSON,
    typeInto,
} from './driver';
import { openTestVault } from './testVault';

describe('person search hotkey', () => {
    let vault: TemporaryVault;

    beforeAll(async () => {
        vault = await openTestVault('focus-person-search');
    });

    afterAll(async () => {
        await vault?.dispose();
    });

    const openFreshImage = async (name: string) => {
        const imagePath = `images/${name}.png`;
        await copyImage(vault, 'images/Clerk_Maxwell.png', imagePath);
        await openImageInTagger(vault, imagePath);
    };

    // Types without clicking the input first, so the text only lands there if
    // the hotkey focused it.
    const typeKeys = async (text: string) => {
        for (const key of text) {
            await pressKey(vault, key);
        }
    };

    it('focuses the person search on Shift+S', async () => {
        await openFreshImage('hotkey-focus');
        expect(await isFocused(vault, PERSON_INPUT)).toBe(false);

        await pressKey(vault, 'S', ['Shift']);

        await expect.poll(() => isFocused(vault, PERSON_INPUT)).toBe(true);
        await typeKeys('Marie');
        // The hotkey itself is not typed into the input.
        await expect.poll(() => getInputValue(vault, PERSON_INPUT)).toBe('Marie');
        await expect
            .poll(async () => (await getSuggestions(vault, PERSON_LIST)).map((row) => row.label))
            .toEqual(['Marie_Curie']);
    });

    it('replaces a selected person with the search on Shift+S', async () => {
        await openFreshImage('hotkey-replace');
        await typeInto(vault, PERSON_INPUT, 'Marie');
        await expect.poll(async () => (await getSuggestions(vault, PERSON_LIST)).length).toBe(1);
        await pressKey(vault, 'Enter');
        await expect.poll(() => getTexts(vault, SELECTED_PERSON)).toEqual(['Marie_Curie']);

        await pressKey(vault, 'S', ['Shift']);

        await expect.poll(() => isFocused(vault, PERSON_INPUT)).toBe(true);
        expect(await getTexts(vault, SELECTED_PERSON)).toEqual([]);
        await typeKeys('Isaac');
        await expect
            .poll(async () => (await getSuggestions(vault, PERSON_LIST)).map((row) => row.label))
            .toEqual(['Isaac_Newton']);
    });

    it('types a capital S in a text field instead', async () => {
        await openFreshImage('hotkey-text-field');
        await typeInto(vault, HASHTAG_INPUT, 'a');

        await pressKey(vault, 'S', ['Shift']);

        await expect.poll(() => getInputValue(vault, HASHTAG_INPUT)).toBe('aS');
        expect(await isFocused(vault, HASHTAG_INPUT)).toBe(true);
        expect(await getInputValue(vault, PERSON_INPUT)).toBe('');
    });
});
