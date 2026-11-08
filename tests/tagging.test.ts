import { TemporaryVault } from 'obsidian-integration-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    clickElement,
    copyImage,
    expectDb,
    getInputValue,
    getSuggestions,
    getTexts,
    HASHTAG_CHIP,
    HASHTAG_INPUT,
    HASHTAG_LIST,
    openImageInTagger,
    PERSON_INPUT,
    PERSON_LIST,
    pressKey,
    readDb,
    SELECTED_PERSON,
    TAG_ITEM,
    TAGGER_IMAGE,
    typeInto,
} from './driver';
import { openTestVault } from './testVault';

const IMAGE_WIDTH = 898;
const IMAGE_HEIGHT = 673;

describe('tagging', () => {
    let vault: TemporaryVault;

    beforeAll(async () => {
        vault = await openTestVault('tagging');
    });

    afterAll(async () => {
        await vault?.dispose();
    });

    // A copy of the image has no tags or hashtags yet, unlike the base vault's images.
    const openFreshImage = async (name: string) => {
        const imagePath = `images/${name}.png`;
        await copyImage(vault, 'images/Clerk_Maxwell.png', imagePath);
        await openImageInTagger(vault, imagePath);
        return imagePath;
    };

    const expectSelectedRow = async (listSelector: string, index: number) => {
        await expect
            .poll(async () => {
                const rows = await getSuggestions(vault, listSelector);
                return rows.findIndex((row) => row.isSelected);
            })
            .toBe(index);
    };

    it('selects a person with the arrow keys and enter', async () => {
        const imagePath = await openFreshImage('select-person');

        await typeInto(vault, PERSON_INPUT, 'md');
        await expect
            .poll(async () => (await getSuggestions(vault, PERSON_LIST)).length)
            .toBeGreaterThanOrEqual(3);
        const rows = await getSuggestions(vault, PERSON_LIST);
        const lastIndex = rows.length - 1;

        await expectSelectedRow(PERSON_LIST, 0);

        // Up from the first row wraps to the last one, and down from there wraps back.
        await pressKey(vault, 'Up');
        await expectSelectedRow(PERSON_LIST, lastIndex);
        await pressKey(vault, 'Down');
        await expectSelectedRow(PERSON_LIST, 0);
        await pressKey(vault, 'Down');
        await expectSelectedRow(PERSON_LIST, 1);

        await pressKey(vault, 'Enter');

        // The second row, not the one highlighted by default.
        await expect.poll(() => getTexts(vault, SELECTED_PERSON)).toEqual([rows[1]?.label]);
        // No coordinates were set, so there is nothing to tag yet.
        expect(await getTexts(vault, TAG_ITEM)).toEqual([]);
        expect((await readDb(vault)).tags[imagePath]).toBeUndefined();
    });

    it('selects a hashtag with the arrow keys and enter', async () => {
        const imagePath = await openFreshImage('select-hashtag');

        await typeInto(vault, HASHTAG_INPUT, 'c');
        await expect
            .poll(async () => (await getSuggestions(vault, HASHTAG_LIST)).map((row) => row.label))
            .toEqual(['#science', '#conference', 'Create «c»']);
        await expectSelectedRow(HASHTAG_LIST, 0);

        // Up from the first row wraps to the last one, and down from there wraps back.
        await pressKey(vault, 'Up');
        await expectSelectedRow(HASHTAG_LIST, 2);
        await pressKey(vault, 'Down');
        await expectSelectedRow(HASHTAG_LIST, 0);
        await pressKey(vault, 'Down');
        await expectSelectedRow(HASHTAG_LIST, 1);

        await pressKey(vault, 'Enter');

        await expect.poll(() => getTexts(vault, HASHTAG_CHIP)).toEqual(['#conference']);
        await expectDb(vault, (db) => {
            const paths = (name: string) => db.hashTags[name]?.map(({ path }) => path);

            expect(paths('conference')).toContain(imagePath);
            expect(paths('science')).not.toContain(imagePath);
            expect(paths('c')).toBeUndefined();
        });
    });

    it('creates the tag as soon as a person is submitted for set coordinates', async () => {
        const imagePath = await openFreshImage('auto-tag');

        await clickElement(vault, TAGGER_IMAGE);
        await expect
            .poll(() => getTexts(vault, `${TAGGER_IMAGE} ~ .photo-tagging-cursor-marker`))
            .toHaveLength(1);

        await typeInto(vault, PERSON_INPUT, 'Marie');
        await expect
            .poll(async () => (await getSuggestions(vault, PERSON_LIST)).map((row) => row.label))
            .toEqual(['Marie_Curie']);
        await pressKey(vault, 'Enter');

        await expect.poll(() => getTexts(vault, TAG_ITEM)).toEqual(['Marie_Curie']);
        await expectDb(vault, (db) => {
            const tags = db.tags[imagePath];
            expect(tags).toHaveLength(1);

            const tag = tags?.[0];
            expect(tag?.id).toBeTruthy();
            expect(tag).toMatchObject({
                person: 'Marie_Curie',
                filePath: 'Marie_Curie.md',
                imageWidth: IMAGE_WIDTH,
                imageHeight: IMAGE_HEIGHT,
            });
            // The click landed on the center of the image. The coordinates are in the
            // pixels of the original image, so they are not exact on a scaled-down one.
            expect(tag?.coords.x).toBeCloseTo(IMAGE_WIDTH / 2, -1);
            expect(tag?.coords.y).toBeCloseTo(IMAGE_HEIGHT / 2, -1);
        });

        // The form is ready for the next person.
        expect(await getInputValue(vault, PERSON_INPUT)).toBe('');
        expect(await getTexts(vault, SELECTED_PERSON)).toEqual([]);
    });

    it('creates a new hashtag when an unknown name is submitted', async () => {
        const imagePath = await openFreshImage('new-hashtag');
        const hashtag = 'brandnewhashtag';

        expect((await readDb(vault)).hashTags[hashtag]).toBeUndefined();

        await typeInto(vault, HASHTAG_INPUT, hashtag);
        await expect
            .poll(async () => (await getSuggestions(vault, HASHTAG_LIST)).map((row) => row.label))
            .toEqual([`Create «${hashtag}»`]);
        await pressKey(vault, 'Enter');

        await expect.poll(() => getTexts(vault, HASHTAG_CHIP)).toEqual([`#${hashtag}`]);
        await expectDb(vault, (db) => {
            expect(db.hashTags[hashtag]).toEqual([
                { path: imagePath, imageWidth: IMAGE_WIDTH, imageHeight: IMAGE_HEIGHT },
            ]);
        });
    });
});
