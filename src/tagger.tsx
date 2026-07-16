import {
    ItemView,
    WorkspaceLeaf,
    ViewStateResult,
    TAbstractFile,
    App,
    TFile,
    getIcon,
} from 'obsidian';
import type PhotoTagging from './main';
import {
    createContext,
    StrictMode,
    useState,
    useContext,
    MouseEvent,
    useRef,
    useEffect,
    useMemo,
    KeyboardEvent,
} from 'react';
import { Root, createRoot } from 'react-dom/client';

export const VIEW_TYPE = 'photo-tagger-view';

interface TaggerState {
    file: TAbstractFile | null;
    tags: Tag[];
    setTags: (tags: Tag[]) => void;
    hashtags: string[];
    setHashtags: (hashtags: string[], imageWidth: number, imageHeight: number) => void;
    allHashtagNames: string[];
}

// What's persisted for this tab across Obsidian restarts (see
// `TaggerView.getState`/`TaggerView.setState`) — just enough to look the
// image back up and rebuild the rest of the state from the live db.
type PersistedTaggerState = { filePath: string | null };

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

export type ImagePath = {
    path: string;
    imageWidth: number;
    imageHeight: number;
};

const HashtagInput = ({
    hashtags,
    setHashtags,
    allHashtagNames,
}: {
    hashtags: string[];
    setHashtags: (hashtags: string[]) => void;
    allHashtagNames: string[];
}) => {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const suggestions = useMemo(() => {
        if (!query.trim()) {
            return [];
        }

        const q = query.toLowerCase();
        return allHashtagNames.filter(
            (name) => name.toLowerCase().includes(q) && !hashtags.includes(name),
        );
    }, [query, allHashtagNames, hashtags]);

    const exactMatch = allHashtagNames.some(
        (hashtagName) => hashtagName.toLowerCase() === query.trim().toLowerCase(),
    );
    const showCreate = query.trim() && !exactMatch && !hashtags.includes(query.trim());

    const addHashtag = (name: string) => {
        if (!hashtags.includes(name)) {
            setHashtags([...hashtags, name]);
        }

        setQuery('');
    };

    const removeHashtag = (name: string) => {
        setHashtags(hashtags.filter((hashtagName) => hashtagName !== name));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && query.trim()) {
            e.preventDefault();
            // If there's exactly one suggestion, pick it; otherwise create.
            if (suggestions.length === 1) {
                addHashtag(suggestions[0]!);
            } else if (showCreate) {
                addHashtag(query.trim());
            } else if (suggestions.length > 0) {
                addHashtag(suggestions[0]!);
            }
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    placeholder="Add hashtag..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        // Delay to allow click on suggestion.
                        setTimeout(() => setIsFocused(false), 150);
                    }}
                    onKeyDown={handleKeyDown}
                    style={{ width: '100%' }}
                />
                {isFocused && (suggestions.length > 0 || showCreate) && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            padding: '4px',
                            backgroundColor: 'var(--background-secondary)',
                            borderRadius: '4px',
                            marginTop: '2px',
                        }}
                    >
                        {suggestions.map((name) => (
                            <div
                                key={name}
                                onMouseDown={() => addHashtag(name)}
                                className="suggestion-item"
                                style={{
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontSize: '0.9em',
                                }}
                            >
                                #{name}
                            </div>
                        ))}
                        {showCreate && (
                            <div
                                onMouseDown={() => addHashtag(query.trim())}
                                className="suggestion-item"
                                style={{
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontSize: '0.9em',
                                    fontStyle: 'italic',
                                }}
                            >
                                Create &laquo;{query.trim()}&raquo;
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                }}
            >
                {hashtags.map((ht) => (
                    <span
                        key={ht}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'var(--background-modifier-hover)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.85em',
                        }}
                    >
                        #{ht}
                        <button
                            className="photo-tagging-delete-button"
                            onClick={() => removeHashtag(ht)}
                            aria-label={`Remove hashtag ${ht}`}
                            title={`Remove hashtag ${ht}`}
                            style={{ backgroundColor: 'transparent', border: 'none' }}
                            dangerouslySetInnerHTML={{
                                __html: getIcon('x')?.outerHTML || '',
                            }}
                        />
                    </span>
                ))}
            </div>
        </div>
    );
};

export const ReactView = ({
    file,
    tags,
    setTags,
    hashtags,
    setHashtags,
    allHashtagNames,
}: TaggerState) => {
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
                        : 'Click the image to tag'}
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
                    <hr style={{ margin: '0.5em' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
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
                                    backgroundColor: 'var(--background-modifier-hover)',
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
                                    className="photo-tagging-delete-button"
                                    onClick={(e) => handleDeleteTag(e, tag.id)}
                                    aria-label="Remove tag"
                                    title="Remove tag"
                                    style={{ backgroundColor: 'transparent', border: 'none' }}
                                    dangerouslySetInnerHTML={{
                                        __html: getIcon('x')?.outerHTML || '',
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <hr style={{ margin: '0.5em' }} />
                    <HashtagInput
                        hashtags={hashtags}
                        setHashtags={(newHashtags) =>
                            setHashtags(newHashtags, imgSize.naturalWidth, imgSize.naturalHeight)
                        }
                        allHashtagNames={allHashtagNames}
                    />
                </div>
            </div>
        </div>
    );
};

export class TaggerView extends ItemView {
    root: Root | null = null;
    plugin: PhotoTagging;
    taggerState: TaggerState = {
        file: null,
        tags: [],
        setTags: () => {},
        hashtags: [],
        setHashtags: () => {},
        allHashtagNames: [],
    };

    constructor(leaf: WorkspaceLeaf, plugin: PhotoTagging) {
        super(leaf);

        this.plugin = plugin;
        this.navigation = true;
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getIcon() {
        return 'user-round-search';
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

    getState(): Record<string, unknown> {
        const persisted: PersistedTaggerState = {
            filePath: this.taggerState.file instanceof TFile ? this.taggerState.file.path : null,
        };

        return persisted;
    }

    resolveState(state: unknown): TaggerState | null {
        if (state && typeof (state as Partial<TaggerState>).setTags === 'function') {
            return state as TaggerState;
        }

        const filePath = (state as Partial<PersistedTaggerState> | undefined)?.filePath;
        if (!filePath) {
            return null;
        }

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
            return null;
        }

        return { file, ...this.plugin.buildTaggerContext(file) };
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const resolvedState = this.resolveState(state);

        if (resolvedState) {
            this.taggerState = {
                file: resolvedState.file || null,
                tags: resolvedState.tags || [],
                setTags: (tags: Tag[]) => {
                    this.taggerState.tags = tags;
                    this.renderView();

                    if (resolvedState.setTags) {
                        resolvedState.setTags(tags);
                    }
                },
                hashtags: resolvedState.hashtags || [],
                setHashtags: (hashtags: string[], imageWidth: number, imageHeight: number) => {
                    this.taggerState.hashtags = hashtags;
                    this.renderView();

                    if (resolvedState.setHashtags) {
                        resolvedState.setHashtags(hashtags, imageWidth, imageHeight);
                    }
                },
                allHashtagNames: resolvedState.allHashtagNames || [],
            };

            this.renderView();
        }

        result.history = true;

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
                        hashtags={this.taggerState.hashtags}
                        setHashtags={this.taggerState.setHashtags}
                        allHashtagNames={this.taggerState.allHashtagNames}
                    />
                </StrictMode>
            </AppContext.Provider>,
        );
    }
}
