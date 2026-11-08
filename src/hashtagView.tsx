import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';

import type PhotoTagging from './main';
import { HashtagPhotoList } from './photoList';

export const HASHTAG_VIEW_TYPE = 'photo-tagging-hashtag-view';

// What's persisted for this tab across Obsidian restarts.
export type HashtagViewState = { hashtag: string | null };

// A tab showing every photo with a given hashtag. It isn't backed by a file,
// so opening a hashtag doesn't add anything to the vault.
export class HashtagView extends ItemView {
    root: Root | null = null;
    plugin: PhotoTagging;
    hashtag: string | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: PhotoTagging) {
        super(leaf);

        this.plugin = plugin;
        this.navigation = true;
    }

    getViewType() {
        return HASHTAG_VIEW_TYPE;
    }

    getIcon() {
        return 'hash';
    }

    getDisplayText() {
        return this.hashtag ? `#${this.hashtag}` : 'Hashtag';
    }

    async onOpen() {
        this.renderView();
    }

    async onClose() {
        this.root?.unmount();
    }

    getState(): Record<string, unknown> {
        const persisted: HashtagViewState = { hashtag: this.hashtag };

        return persisted;
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        this.hashtag = (state as Partial<HashtagViewState> | undefined)?.hashtag ?? null;
        this.renderView();

        result.history = true;

        await super.setState(state, result);
    }

    renderView() {
        if (!this.root) {
            this.root = createRoot(this.contentEl);
        }

        this.root.render(
            <StrictMode>
                {this.hashtag !== null && (
                    <HashtagPhotoList
                        key={this.hashtag}
                        app={this.app}
                        manifest={this.plugin.manifest}
                        hashtag={this.hashtag}
                        hashTags={this.plugin.hashTags}
                    />
                )}
            </StrictMode>,
        );
    }
}
