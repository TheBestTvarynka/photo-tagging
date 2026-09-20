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
import { HashtagInput } from './hashtagInput';
import { comboboxProps, SuggestionList, useSuggestionList } from './suggestionList';
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

    const createTag = (file: TFile) => {
        if (!coords) {
            return;
        }

        const newTag: Tag = {
            id: crypto.randomUUID(),
            person: file.basename,
            coords: coords,
            filePath: file.path,
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

    const handleSelectFile = (file: TFile) => {
        // Coordinates are already set (image was clicked first), so tag the
        // person immediately instead of requiring a separate "Add Tag" click.
        if (coords && tagCoords) {
            createTag(file);
            return;
        }

        setSelectedFile(file);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleAddTag = () => {
        if (!selectedFile || !coords || !tagCoords) {
            return;
        }

        createTag(selectedFile);
    };

    const searchList = useSuggestionList({
        items: searchResults,
        onCommit: handleSelectFile,
    });

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
        <div className="photo-tagging-layout">
            <div style={{ position: 'relative', height: 'fit-content', alignSelf: 'center' }}>
                {imageSrc ? (
                    <>
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            onClick={handleImageClick}
                            className="photo-tagging-image"
                            draggable={false}
                            alt={imageName}
                        />
                        {tagCoords && (
                            <div
                                className="photo-tagging-cursor-marker"
                                style={{ left: tagCoords.x, top: tagCoords.y }}
                            />
                        )}
                        {tags.map((tag, index) => {
                            const x = (tag.coords.x / imgSize.naturalWidth) * imgSize.width;
                            const y = (tag.coords.y / imgSize.naturalHeight) * imgSize.height;

                            return (
                                <div
                                    key={`tag-${index}`}
                                    className={
                                        hoveredTagIndex === index
                                            ? 'photo-tagging-tag-dot photo-tagging-tag-dot--hovered'
                                            : 'photo-tagging-tag-dot'
                                    }
                                    style={{ left: x, top: y }}
                                />
                            );
                        })}
                    </>
                ) : (
                    <span>No Image Selected</span>
                )}
            </div>
            <div className="photo-tagging-sidebar">
                <span style={{ fontFamily: 'monospace' }}>
                    {coords
                        ? `Coordinates: (${Math.round(coords.x)}, ${Math.round(coords.y)})`
                        : 'Click the image to tag'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
                    {selectedFile ? (
                        <div className="photo-tagging-selected-file">
                            <span
                                onClick={() => {
                                    openFile(selectedFile).catch((err) => console.error(err));
                                }}
                                style={{ cursor: 'pointer', alignSelf: 'center' }}
                            >
                                {selectedFile.basename}
                            </span>
                            <button
                                className="photo-tagging-delete-button"
                                onClick={() => setSelectedFile(null)}
                                aria-label="Clear selection"
                                title="Clear selection"
                                style={{ backgroundColor: 'transparent', border: 'none' }}
                                dangerouslySetInnerHTML={{
                                    __html: getIcon('x')?.outerHTML || '',
                                }}
                            />
                        </div>
                    ) : (
                        <input
                            type="text"
                            placeholder="Search page..."
                            value={searchQuery}
                            {...comboboxProps(searchList)}
                            onChange={(e) => handleSearch(e.target.value)}
                            onKeyDown={searchList.handleKeyDown}
                        />
                    )}
                    <SuggestionList
                        list={searchList}
                        items={searchResults}
                        className="photo-tagging-search-results"
                        getKey={(file) => file.path}
                        getLabel={(file) => file.basename}
                    />

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
                                className={
                                    hoveredTagIndex === index
                                        ? 'photo-tagging-tag-item photo-tagging-tag-item--hovered'
                                        : 'photo-tagging-tag-item'
                                }
                            >
                                <span
                                    style={{
                                        fontWeight: 'bold',
                                        alignSelf: 'center',
                                        // I hate to write `paddingTop: '3px'`, but I do not know why the `span` text is not vertically centered. Fuck this shit.
                                        paddingTop: '3px',
                                    }}
                                >
                                    {tag.person}
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
