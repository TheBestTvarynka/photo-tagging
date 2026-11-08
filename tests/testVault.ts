import { cp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { evalInObsidian, TemporaryVault } from 'obsidian-integration-testing';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const BASE_VAULT_PATH = join(PROJECT_ROOT, 'assets', 'base_vault');
const PLUGIN_ID = 'photo-tagging';
const PLUGIN_FILES = ['main.js', 'manifest.json', 'styles.css'];

// Clones the base vault into `test_vaults/<name>`, updates its plugin with the
// fresh build, and opens it in the test Obsidian instance. The clone is left on
// disk after the run for inspection, and replaced by the next run.
export async function openTestVault(name: string): Promise<TemporaryVault> {
    const vaultPath = join(PROJECT_ROOT, 'test_vaults', name);

    await rm(vaultPath, { recursive: true, force: true });
    await cp(BASE_VAULT_PATH, vaultPath, { recursive: true });

    for (const file of PLUGIN_FILES) {
        await cp(
            join(PROJECT_ROOT, file),
            // eslint-disable-next-line obsidianmd/hardcoded-config-path -- the base vault's own folder.
            join(vaultPath, '.obsidian', 'plugins', PLUGIN_ID, file),
        );
    }

    const vault = new TemporaryVault(vaultPath);
    await vault.register();

    const isLoaded = await evalInObsidian({
        input: { pluginId: PLUGIN_ID },
        callback: async ({ app, pluginId }) => {
            // A vault opened for the first time starts in restricted mode.
            if (!app.plugins.isEnabled()) {
                await app.plugins.setEnable(true);
            }
            if (!Object.hasOwn(app.plugins.plugins, pluginId)) {
                await app.plugins.enablePluginAndSave(pluginId);
            }

            return Object.hasOwn(app.plugins.plugins, pluginId);
        },
        vaultPath,
    });

    if (!isLoaded) {
        throw new Error(`Plugin ${PLUGIN_ID} failed to load in ${vaultPath}`);
    }

    return vault;
}
