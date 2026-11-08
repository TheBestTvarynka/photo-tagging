import process from 'node:process';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        // All test files share one Obsidian instance.
        fileParallelism: false,
        globalSetup: ['obsidian-integration-testing/vitest-global-setup-no-plugin'],
        // CI runners can't use Electron's sandbox.
        environmentOptions: {
            obsidianTransport: { shouldDisableSandbox: Boolean(process.env.CI) },
        },
        testTimeout: 60_000,
        hookTimeout: 120_000,
    },
});
