import { ItemView, WorkspaceLeaf, ViewStateResult, TAbstractFile } from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';

export const VIEW_TYPE = 'photo-tagger-view';

interface TaggerState {
    file: TAbstractFile | null;
}

export const ReactView = ({ file }: TaggerState) => {
    return (
        <div>
            <h4>Photo Tagger</h4>
            <p>
                <b>File Name:</b> {file?.name}
            </p>
            <p>
                <b>File Path:</b> {file?.path}
            </p>
        </div>
    );
};

export class TaggerView extends ItemView {
    root: Root | null = null;
    taggerState: TaggerState = { file: null };

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return 'Tagger';
    }

    async onOpen() {
        this.renderView();
    }

    async onClose() {
        this.root?.unmount();
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state) {
            this.taggerState = {
                file: state.file || null,
            };
            this.renderView();
        }
        await super.setState(state, result);
    }

    renderView() {
        if (!this.root) {
            this.root = createRoot(this.contentEl);
        }

        this.root.render(
            <StrictMode>
                <ReactView file={this.taggerState.file} />
            </StrictMode>,
        );
    }
}
