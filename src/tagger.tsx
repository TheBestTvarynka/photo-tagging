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
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCoords({ x, y });
    };

    return (
        <div
            style={{
                display: 'grid',
                width: '100%',
                height: '100%',
                gridTemplateColumns: '80% 20%',
            }}
        >
            <div
                style={{
                    height: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        onClick={handleImageClick}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            cursor: 'crosshair',
                            display: 'block',
                        }}
                        draggable={false}
                        alt={imageName}
                    />
                ) : (
                    <div style={{ color: 'var(--text-muted)' }}>No Image Selected</div>
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
                <span style={{ fontFamily: 'monospace' }}>
                    {coords ? `X: ${coords.x}, Y: ${coords.y}` : 'Click image to tag'}
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
