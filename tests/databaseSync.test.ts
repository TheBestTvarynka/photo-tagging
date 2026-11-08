import { TemporaryVault } from 'obsidian-integration-testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SerializedDb } from '../src/migrations';
import { deleteFile, expectDb, readDb, renameFile } from './driver';
import { openTestVault } from './testVault';

const hashtagPaths = (db: SerializedDb, hashtag: string) =>
    db.hashTags[hashtag]?.map(({ path }) => path);

const tagsOfPerson = (db: SerializedDb, notePath: string) =>
    Object.values(db.tags)
        .flat()
        .filter((tag) => tag.filePath === notePath);

describe('database sync', () => {
    let vault: TemporaryVault;

    beforeAll(async () => {
        vault = await openTestVault('database-sync');
    });

    afterAll(async () => {
        await vault?.dispose();
    });

    // Every test works on its own files, as they share one vault and one database.
    describe('on rename', () => {
        it('updates the records of a renamed image', async () => {
            const oldPath = 'images/Galileo_Galilei.png';
            const newPath = 'images/Galileo_renamed.png';
            const tags = (await readDb(vault)).tags[oldPath];
            expect(tags).toHaveLength(1);

            await renameFile(vault, oldPath, newPath);

            await expectDb(vault, (db) => {
                expect(db.tags[newPath]).toEqual(tags);
                expect(db.tags[oldPath]).toBeUndefined();
                expect(hashtagPaths(db, 'science')).toContain(newPath);
                expect(hashtagPaths(db, 'science')).not.toContain(oldPath);
            });
        });

        it('updates the records of an image moved to another folder', async () => {
            const oldPath = 'images/Isaac_Newton.png';
            const newPath = 'archive/Isaac_Newton.png';
            const tags = (await readDb(vault)).tags[oldPath];
            expect(tags).toHaveLength(1);

            await renameFile(vault, oldPath, newPath);

            await expectDb(vault, (db) => {
                expect(db.tags[newPath]).toEqual(tags);
                expect(db.tags[oldPath]).toBeUndefined();
                expect(hashtagPaths(db, 'science')).toContain(newPath);
                expect(hashtagPaths(db, 'science')).not.toContain(oldPath);
            });
        });

        it('updates every tag of a renamed person note', async () => {
            const oldPath = 'Albert_Einstein.md';
            const newPath = 'people/Einstein.md';
            const tagIds = tagsOfPerson(await readDb(vault), oldPath).map(({ id }) => id);
            expect(tagIds).toHaveLength(2);

            await renameFile(vault, oldPath, newPath);

            await expectDb(vault, (db) => {
                expect(tagsOfPerson(db, newPath).map(({ id }) => id)).toEqual(tagIds);
                expect(tagsOfPerson(db, oldPath)).toEqual([]);
            });
        });
    });

    describe('on delete', () => {
        it('removes the records of a deleted image', async () => {
            const path = 'images/Clerk_Maxwell.png';
            const before = await readDb(vault);
            expect(before.tags[path]).toHaveLength(1);
            expect(hashtagPaths(before, 'science')).toContain(path);

            await deleteFile(vault, path);

            await expectDb(vault, (db) => {
                expect(db.tags[path]).toBeUndefined();
                expect(hashtagPaths(db, 'science')).not.toContain(path);
            });
        });

        it('removes every tag of a deleted person note and keeps the others', async () => {
            const path = 'Marie_Curie.md';
            const groupImage = 'images/the_most_intelligent_image.jpeg';
            const before = await readDb(vault);
            expect(tagsOfPerson(before, path)).toHaveLength(2);
            const otherTagIds = before.tags[groupImage]
                ?.filter((tag) => tag.filePath !== path)
                .map(({ id }) => id);
            expect(otherTagIds).toHaveLength(1);

            await deleteFile(vault, path);

            await expectDb(vault, (db) => {
                expect(tagsOfPerson(db, path)).toEqual([]);
                expect(db.tags[groupImage]?.map(({ id }) => id)).toEqual(otherTagIds);
            });
        });
    });
});
