import { ItemView, WorkspaceLeaf, ViewStateResult, TAbstractFile, App, TFile } from 'obsidian';
import { createContext, StrictMode, useState, useContext, MouseEvent } from 'react';
import { Root, createRoot } from 'react-dom/client';

export const VIEW_TYPE = 'photo-tagger-view';

interface TaggerState {
    file: TAbstractFile | null;
}

export const AppContext = createContext<App | undefined>(undefined);

export const ReactView = ({ file }: TaggerState) => {
    const app = useContext(AppContext);
    const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

    const imageSrc = file instanceof TFile && app ? app.vault.getResourcePath(file) : null;
    const imageName = file?.name || 'Unknown';

    const handleImageClick = (e: MouseEvent<HTMLImageElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();

        console.log({ width: e.currentTarget.width, height: e.currentTarget.height });
        console.log({
            naturalWidth: e.currentTarget.naturalWidth,
            naturalHeight: e.currentTarget.naturalHeight,
        });

        const width = e.currentTarget.width;
        const height = e.currentTarget.height;

        const naturalWidth = e.currentTarget.naturalWidth;
        const naturalHeight = e.currentTarget.naturalHeight;

        const x = ((e.clientX - rect.left) / width) * naturalWidth;
        const y = ((e.clientY - rect.top) / height) * naturalHeight;

        setCoords({ x, y });
    };

    return (
        <div
            style={{
                display: 'grid',
                width: '100%',
                height: '100%',
                gridTemplateColumns: '80% 20%',
                overflow: 'hidden',
            }}
        >
            <div style={{ aspectRatio: '1 / 1' }}>
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        onClick={handleImageClick}
                        style={{
                            objectFit: 'cover',
                            cursor: 'crosshair',
                        }}
                        draggable={false}
                        alt={imageName}
                    />
                ) : (
                    <span>No Image Selected</span>
                )}
            </div>
            <div
                style={{
                    padding: '0.5em',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5em',
                }}
            >
                <span>Coordinates:</span>
                <span style={{ fontFamily: 'monospace' }}>
                    {coords
                        ? `X: ${Math.round(coords.x)}, Y: ${Math.round(coords.y)}`
                        : 'Click image to tag'}
                </span>
            </div>
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
            <AppContext.Provider value={this.app}>
                <StrictMode>
                    <ReactView file={this.taggerState.file} />
                </StrictMode>
            </AppContext.Provider>,
        );
    }
}
