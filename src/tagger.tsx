import { ItemView, WorkspaceLeaf, ViewStateResult, TAbstractFile, App, TFile } from 'obsidian';
import { createContext, StrictMode, useState, useContext, MouseEvent } from 'react';
import { Root, createRoot } from 'react-dom/client';

export const VIEW_TYPE = 'photo-tagger-view';

interface TaggerState {
    file: TAbstractFile | null;
}

export const AppContext = createContext<App | undefined>(undefined);

type TagCoords = {
    x: number;
    y: number;
};

type PhotoCoords = {
    x: number;
    y: number;
};

export const ReactView = ({ file }: TaggerState) => {
    const app = useContext(AppContext);
    const [coords, setCoords] = useState<PhotoCoords | null>(null);
    const [tagCoords, setTagCoords] = useState<TagCoords | null>(null);

    const imageSrc = file instanceof TFile && app ? app.vault.getResourcePath(file) : null;
    const imageName = file?.name || 'Unknown';

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<TFile | null>(null);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);

            return;
        }

        if (!app) {
            return;
        }

        const files = app.vault.getMarkdownFiles();
        const results = files
            .filter((file) => file.path.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10);
        setSearchResults(results);
    };

    const handleSelectFile = (file: TFile) => {
        setSelectedFile(file);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleImageClick = (e: MouseEvent<HTMLImageElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();

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
                <span style={{ fontFamily: 'monospace' }}>
                    {coords
                        ? `Coordinates: (${Math.round(coords.x)}, ${Math.round(coords.y)})`
                        : 'Click image to tag'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="Search page..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    {selectedFile && (
                        <div style={{ fontSize: '0.9em' }}>Selected: {selectedFile.basename}</div>
                    )}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            padding: '4px',
                        }}
                    >
                        {searchResults.map((file) => (
                            <div
                                key={file.path}
                                onClick={() => handleSelectFile(file)}
                                style={{
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontSize: '0.9em',
                                }}
                                className="suggestion-item"
                            >
                                {file.basename}
                            </div>
                        ))}
                    </div>
                </div>
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
