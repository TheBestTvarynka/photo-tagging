import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        // All test files share one Obsidian instance.
        fileParallelism: false,
        globalSetup: ['obsidian-integration-testing/vitest-global-setup-no-plugin'],
        testTimeout: 60_000,
        hookTimeout: 120_000,
    },
});
