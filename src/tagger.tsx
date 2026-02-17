import { ItemView, WorkspaceLeaf, ViewStateResult, TAbstractFile, App, TFile } from 'obsidian';
import {
    createContext,
    StrictMode,
    useState,
    useContext,
    MouseEvent,
    useRef,
    useEffect,
} from 'react';
import { Root, createRoot } from 'react-dom/client';

export const VIEW_TYPE = 'photo-tagger-view';

interface TaggerState {
    file: TAbstractFile | null;
    tags: Tag[];
    setTags: (tags: Tag[]) => void;
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

export type Tag = {
    id: string;
    coords: PhotoCoords;
    person: string;
    filePath: string;
    imageWidth: number;
    imageHeight: number;
};

export const ReactView = ({ file, tags, setTags }: TaggerState) => {
    const app = useContext(AppContext);

    const [coords, setCoords] = useState<PhotoCoords | null>(null);
    const [tagCoords, setTagCoords] = useState<TagCoords | null>(null);
    const [hoveredTagIndex, setHoveredTagIndex] = useState<number | null>(null);

    const imageSrc = file instanceof TFile && app ? app.vault.getResourcePath(file) : null;
    const imageName = file?.name || 'Unknown';

    const imgRef = useRef<HTMLImageElement>(null);
    // We need it to calculate relative tag coordinates.
    const [imgSize, setImgSize] = useState({
        width: 0,
        height: 0,
        naturalWidth: 0,
        naturalHeight: 0,
    });

    useEffect(() => {
        const updateSize = () => {
            if (!imgRef.current) {
                return;
            }

            setImgSize({
                width: imgRef.current.width,
                height: imgRef.current.height,
                naturalWidth: imgRef.current.naturalWidth,
                naturalHeight: imgRef.current.naturalHeight,
            });
        };

        const img = imgRef.current;
        if (!img) {
            return;
        }

        updateSize();
        if (img.complete) {
            updateSize();
        }

        img.addEventListener('load', updateSize);

        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });
        resizeObserver.observe(img);

        return () => {
            img.removeEventListener('load', updateSize);
            resizeObserver.disconnect();
        };
    }, [imageSrc]);

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

    const handleAddTag = () => {
        if (!selectedFile || !coords || !tagCoords) {
            return;
        }

        const newTag: Tag = {
            id: crypto.randomUUID(),
            person: selectedFile.basename,
            coords: coords,
            filePath: selectedFile.path,
            imageWidth: imgSize.naturalWidth,
            imageHeight: imgSize.naturalHeight,
        };
        setTags([...tags, newTag]);

        setSelectedFile(null);
        setSearchResults([]);
        setSearchQuery('');
        setCoords(null);
        setTagCoords(null);
    };

    const openFile = async (file: TAbstractFile | null) => {
        if (!app) {
            return;
        }

        if (file instanceof TFile) {
            await app.workspace.getLeaf(true).openFile(file);
        }
    };

    const handleTagClick = async (filePath: string) => {
        if (!app) {
            return;
        }

        const file = app.vault.getAbstractFileByPath(filePath);
        await openFile(file);
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
        setTagCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleDeleteTag = (e: MouseEvent, tagId: string) => {
        e.stopPropagation();
        const newTags = tags.filter((t) => t.id !== tagId);
        setTags(newTags);
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
            <div style={{ position: 'relative' }}>
                {imageSrc ? (
                    <>
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            onClick={handleImageClick}
                            style={{
                                objectFit: 'contain',
                                cursor: 'crosshair',
                                width: '100%',
                                height: '100%',
                            }}
                            draggable={false}
                            alt={imageName}
                        />
                        {tagCoords && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: tagCoords.x,
                                    top: tagCoords.y,
                                    width: '10px',
                                    height: '10px',
                                    backgroundColor: 'blue',
                                    borderRadius: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    pointerEvents: 'none',
                                }}
                            />
                        )}
                        {tags.map((tag, index) => {
                            const x = (tag.coords.x / imgSize.naturalWidth) * imgSize.width;
                            const y = (tag.coords.y / imgSize.naturalHeight) * imgSize.height;

                            return (
                                <div
                                    key={`tag-${index}`}
                                    style={{
                                        position: 'absolute',
                                        left: x,
                                        top: y,
                                        width: hoveredTagIndex === index ? '20px' : '10px',
                                        height: hoveredTagIndex === index ? '20px' : '10px',
                                        backgroundColor: 'magenta',
                                        borderRadius: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        pointerEvents: 'none',
                                        transition: 'width 0.5s, height 0.5s',
                                    }}
                                />
                            );
                        })}
                    </>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
                    <input
                        type="text"
                        placeholder="Search page..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    {selectedFile && (
                        <div
                            style={{
                                backgroundColor: 'var(--background-modifier-hover)',
                                padding: '10px',
                                borderRadius: '5px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span
                                onClick={() => {
                                    openFile(selectedFile).catch((err) => console.error(err));
                                }}
                                style={{ cursor: 'pointer', alignSelf: 'center' }}
                            >
                                {selectedFile.basename}
                            </span>
                            <button
                                onClick={() => setSelectedFile(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    lineHeight: '1',
                                    fontSize: '1.2em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: 'auto',
                                }}
                                aria-label="Clear selection"
                            >
                                &times;
                            </button>
                        </div>
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

                    <button
                        onClick={handleAddTag}
                        disabled={!coords || !tagCoords || !selectedFile}
                    >
                        Add Tag
                    </button>
                    <hr />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {tags.map((tag, index) => (
                            <div
                                key={tag.id}
                                onMouseEnter={() => setHoveredTagIndex(index)}
                                onMouseLeave={() => setHoveredTagIndex(null)}
                                onClick={() => {
                                    handleTagClick(tag.filePath).catch((err) => console.error(err));
                                }}
                                style={{
                                    display: 'inline-flex',
                                    justifyContent: 'space-between',
                                    backgroundColor:
                                        hoveredTagIndex === index
                                            ? 'var(--background-modifier-hover)'
                                            : 'transparent',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                }}
                            >
                                <span style={{ fontWeight: 'bold', alignSelf: 'center' }}>
                                    {tag.person}
                                </span>
                                <span style={{ alignSelf: 'center' }}>
                                    {`(${Math.round(tag.coords.x)}, ${Math.round(tag.coords.y)})`}
                                </span>
                                <button
                                    onClick={(e) => handleDeleteTag(e, tag.id)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '0 5px',
                                        fontSize: '1.2em',
                                        lineHeight: '1',
                                    }}
                                    aria-label="Remove tag"
                                >
                                    &times;
                                </button>
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
    taggerState: TaggerState = { file: null, tags: [], setTags: () => {} };

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return this.taggerState.file instanceof TFile ? this.taggerState.file.basename : 'Tagger';
    }

    async onOpen() {
        this.renderView();
    }

    async onClose() {
        this.root?.unmount();
    }

    // Fuck TS.
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    /* eslint-disable  @typescript-eslint/no-unsafe-member-access */
    /* eslint-disable  @typescript-eslint/no-unsafe-assignment */
    /* eslint-disable  @typescript-eslint/no-unsafe-call */
    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state) {
            this.taggerState = {
                file: state.file || null,
                tags: state.tags || [],
                setTags: (tags: Tag[]) => {
                    this.taggerState.tags = tags;
                    this.renderView();

                    if (state.setTags) {
                        state.setTags(tags);
                    }
                },
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
                    <ReactView
                        file={this.taggerState.file}
                        tags={this.taggerState.tags}
                        setTags={this.taggerState.setTags}
                    />
                </StrictMode>
            </AppContext.Provider>,
        );
    }
}
