import {
    App,
    FileSystemAdapter,
    MarkdownPostProcessorContext,
    Menu,
    PluginManifest,
    TFile,
} from 'obsidian';
import { MouseEventHandler, StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import 'photoswipe/dist/photoswipe.css';
import PhotoSwipeDeepZoom from 'photoswipe-deep-zoom-plugin';

import { ImagePath, Tag } from './tagger';
import { ImageTiles, readImageTiles, TILE_SIZE } from './tiling';

type Photo = {
    // Image path for embedding.
    //
    // From Obsidian docs: URI for the browser engine to use, for example to embed an image.
    resourcePath: string;
    // Original file path in vault, used for context menu actions.
    path: string;
    // Original image width.
    width: number;
    // Original image height.
    height: number;
    // Deep-zoom tile pyramid, if this image has been tiled already (see `tiling.ts`).
    tiles: ImageTiles | null;
};

// Resolves an individual deepzoom tile file to a URL the browser can load,
// given the `<a>` element's `data-tile-files-dir` (see `PhotoGallery` below).
// A custom function is required instead of `data-pswp-tile-url` templating
// because Obsidian's resource URLs percent-encode the `{x}`/`{y}`/`{z}`
// placeholders the plugin would otherwise substitute into the template string.
const getTileUrlFn =
    (adapter: FileSystemAdapter) =>
    (data: { element?: HTMLElement }, x: number, y: number, z: number) => {
        const tileFilesDir = data.element?.dataset.tileFilesDir;
        if (!tileFilesDir) {
            return '';
        }
        return adapter.getResourcePath(`${tileFilesDir}/${z}/${x}_${y}.jpg`);
    };

// Converts a gallery anchor into the slide data PhotoSwipe would otherwise
// derive from the DOM itself. We do it by hand because PhotoSwipe's own
// DOM parsing is bound to the main window: `getElementsFromOption` scopes its
// selector to the global `document`, and both it and `getItemData` branch on
// `x instanceof Element`. Obsidian runs plugin code in the main window's realm
// even while rendering into a popout, so a popout's nodes fail that check
// against the main window's `Element` and PhotoSwipe silently ends up with an
// empty gallery. Parsing the anchors ourselves keeps one code path that
// behaves the same in every window.
const anchorToSlideData = (anchor: HTMLAnchorElement) => {
    const thumbnail = anchor.querySelector('img');

    return {
        // The deep-zoom plugin reads its `data-pswp-*` tile settings off this,
        // and PhotoSwipe uses it for the open/close zoom animation.
        element: anchor,
        src: anchor.href,
        width: Number(anchor.dataset.pswpWidth) || 0,
        height: Number(anchor.dataset.pswpHeight) || 0,
        // Preview shown until the full-size image is decoded.
        msrc: thumbnail?.currentSrc || thumbnail?.src,
        alt: thumbnail?.alt ?? '',
    };
};

const NoPhotosMessage = () => <div className="photo-tagging-no-photos">No photos found.</div>;

const PhotoGallery = ({
    app,
    galleryId,
    photos,
}: {
    app: App;
    galleryId: string;
    photos: Photo[];
}) => {
    const galleryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const galleryEl = galleryRef.current;
        if (!galleryEl) {
            return;
        }

        // A note opened in a separate window renders into that window's
        // document, while `document`/`window` here keep pointing at the main
        // one. Pin PhotoSwipe to the gallery's own window so the lightbox is
        // appended next to the thumbnails and sized to the right viewport.
        const doc = galleryEl.ownerDocument;
        const win = doc.defaultView ?? window;
        const isPopout = doc !== document;

        const lightbox = new PhotoSwipeLightbox({
            pswpModule: () => import('photoswipe'),
            appendToEl: doc.body,
            getViewportSizeFn: () => ({
                x: doc.documentElement.clientWidth,
                y: win.innerHeight,
            }),
        });

        if (app.vault.adapter instanceof FileSystemAdapter) {
            new PhotoSwipeDeepZoom(lightbox, {
                tileSize: TILE_SIZE,
                getTileUrlFn: getTileUrlFn(app.vault.adapter),
            });
        }

        // Deliberately not `lightbox.init()`, and no `gallery`/`children`
        // options: both go through the realm-bound DOM lookups described above,
        // and `init`'s click handler would replace our `dataSource` with a
        // gallery element PhotoSwipe cannot read in a popout.
        const handleClick = (event: MouseEvent) => {
            // Let the browser handle modified clicks, like PhotoSwipe does.
            if (
                event.button === 1 ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                event.shiftKey
            ) {
                return;
            }

            const anchor = (event.target as Element | null)?.closest('a');
            if (!anchor) {
                return;
            }

            const anchors = Array.from(galleryEl.querySelectorAll('a'));
            const index = anchors.indexOf(anchor);
            if (index < 0) {
                return;
            }

            event.preventDefault();

            lightbox.options.dataSource = anchors.map(anchorToSlideData);
            lightbox.loadAndOpen(index, undefined, { x: event.clientX, y: event.clientY });
        };

        // PhotoSwipe binds its keyboard and resize handlers to the main window
        // too, so in a popout they never fire. Only the lightbox that is open
        // has a `pswp`, so sibling galleries ignore these.
        const handleKeyDown = (event: KeyboardEvent) => {
            const pswp = lightbox.pswp;
            if (!pswp) {
                return;
            }

            switch (event.key) {
                case 'Escape':
                    pswp.close();
                    break;
                case 'ArrowLeft':
                    pswp.prev();
                    break;
                case 'ArrowRight':
                    pswp.next();
                    break;
                default:
                    return;
            }

            event.preventDefault();
        };
        const handleResize = () => lightbox.pswp?.updateSize();

        galleryEl.addEventListener('click', handleClick);
        if (isPopout) {
            doc.addEventListener('keydown', handleKeyDown);
            win.addEventListener('resize', handleResize);
        }

        return () => {
            galleryEl.removeEventListener('click', handleClick);

            if (isPopout) {
                doc.removeEventListener('keydown', handleKeyDown);
                win.removeEventListener('resize', handleResize);
            }

            lightbox.destroy();
        };
    }, [app]);

    return (
        <div className="pswp-gallery" id={galleryId} ref={galleryRef}>
            {photos.map((image, index) => {
                const handleImageContextMenu: MouseEventHandler<HTMLImageElement> = (event) => {
                    event.preventDefault();
                    const file = app.vault.getAbstractFileByPath(image.path);

                    if (file instanceof TFile) {
                        const menu = new Menu();
                        app.workspace.trigger('file-menu', menu, file, 'canvas-context-menu');
                        menu.showAtPosition({ x: event.pageX, y: event.pageY });
                    } else {
                        console.warn('file not found', image.path);
                    }
                };

                const { tiles } = image;
                const adapter = app.vault.adapter;
                const deepZoomProps =
                    tiles && adapter instanceof FileSystemAdapter
                        ? {
                              'data-pswp-tile-url': 'tiled', // required to be truthy; actual URLs come from getTileUrlFn
                              'data-pswp-tile-type': 'deepzoom',
                              'data-pswp-max-width': image.width,
                              'data-pswp-max-height': image.height,
                              'data-tile-files-dir': tiles.tileFilesVaultPath,
                          }
                        : {};

                const href =
                    tiles && adapter instanceof FileSystemAdapter
                        ? adapter.getResourcePath(tiles.previewVaultPath)
                        : image.resourcePath;
                const width = tiles ? tiles.previewWidth : image.width;
                const height = tiles ? tiles.previewHeight : image.height;

                return (
                    <a
                        href={href}
                        data-pswp-width={width}
                        data-pswp-height={height}
                        key={galleryId + '-' + index}
                        target="_blank"
                        rel="noreferrer"
                        {...deepZoomProps}
                    >
                        <img src={href} alt="" onContextMenu={handleImageContextMenu} />
                    </a>
                );
            })}
        </div>
    );
};

interface PhotoListProps {
    app: App;
    manifest: PluginManifest;
    ctx: MarkdownPostProcessorContext;
    tags: Map<string, Tag[]>;
    hashTags: Map<string, ImagePath[]>;
    source: string;
}

const PhotoList = ({ app, manifest, ctx, tags, hashTags, source }: PhotoListProps) => {
    const options = source.split('\n');
    const groupByHashtags = options.some((line) => line.trim().toLowerCase() === 'group: hashtags');
    let isHashtagType = options.some((line) => line.trim().toLowerCase() === 'type: hashtag');

    if (groupByHashtags && isHashtagType) {
        console.warn(
            'Both group by hashtags and hashtag type are specified. Disabling hashtag type.',
        );
        isHashtagType = false;
    }

    const [allPhotos, setAllPhotos] = useState<Photo[]>([]);

    // Build the flat list of all photos where the current person is tagged.
    useEffect(() => {
        let cancelled = false;

        const currentFile = app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(currentFile instanceof TFile)) {
            return;
        }

        const buildPhoto = async (
            path: string,
            imageWidth: number,
            imageHeight: number,
        ): Promise<Photo | null> => {
            const image = app.vault.getAbstractFileByPath(path);
            if (!(image instanceof TFile)) {
                return null;
            }

            const tiles = await readImageTiles(app, manifest, path);

            return {
                resourcePath: app.vault.getResourcePath(image),
                path,
                width: imageWidth,
                height: imageHeight,
                tiles,
            };
        };

        void (async () => {
            let photoPromises: Promise<Photo | null>[];

            if (isHashtagType) {
                const hashtagPhotos = hashTags.get(currentFile.basename) ?? [];
                photoPromises = hashtagPhotos.map(({ path, imageWidth, imageHeight }) =>
                    buildPhoto(path, imageWidth, imageHeight),
                );
            } else {
                photoPromises = [];
                for (const [imagePath, fileTags] of tags.entries()) {
                    const tag = fileTags.find((tag) => tag.filePath === currentFile.path);
                    if (tag) {
                        photoPromises.push(buildPhoto(imagePath, tag.imageWidth, tag.imageHeight));
                    }
                }
            }

            const photos = (await Promise.all(photoPromises)).filter(
                (photo): photo is Photo => photo !== null,
            );

            if (!cancelled) {
                setAllPhotos(photos);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [app, manifest, ctx.sourcePath, tags, hashTags, isHashtagType]);

    // Build a set of image paths this person appears in for quick lookup.
    const allImagePaths = useMemo(() => new Set(allPhotos.map((p) => p.path)), [allPhotos]);

    // Group photos by hashtag. Each group contains only photos that belong to
    // the current person AND belong to that hashtag.
    const groupedPhotos = useMemo(() => {
        if (!groupByHashtags) {
            return [];
        }

        const groups: { name: string; photos: Photo[] }[] = [];
        const taggedPaths = new Set<string>();

        for (const [hashtagName, imagePaths] of hashTags.entries()) {
            const matching = imagePaths
                .filter((imagePath) => allImagePaths.has(imagePath.path))
                .map((imagePath) => allPhotos.find((photo) => photo.path === imagePath.path))
                .filter((photo): photo is Photo => photo !== undefined);

            if (matching.length > 0) {
                groups.push({ name: hashtagName, photos: matching });
                for (const p of matching) {
                    taggedPaths.add(p.path);
                }
            }
        }

        // Collect photos that don't belong to any hashtag.
        const untagged = allPhotos.filter((p) => !taggedPaths.has(p.path));
        if (untagged.length > 0) {
            groups.push({ name: 'Other', photos: untagged });
        }

        return groups;
    }, [groupByHashtags, hashTags, allImagePaths, allPhotos]);

    const baseGalleryId = 'taggedphotosgallery' + ctx.docId;

    if (!groupByHashtags) {
        if (allPhotos.length === 0) {
            return <NoPhotosMessage />;
        }
        return <PhotoGallery app={app} galleryId={baseGalleryId} photos={allPhotos} />;
    }

    if (groupedPhotos.length === 0) {
        return <NoPhotosMessage />;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
            {groupedPhotos.map((group) => (
                <div key={group.name}>
                    <h3 style={{ marginBottom: '0.5em' }}>#{group.name}</h3>
                    <PhotoGallery
                        app={app}
                        galleryId={baseGalleryId + '-' + group.name}
                        photos={group.photos}
                    />
                </div>
            ))}
        </div>
    );
};

export const mountPhotoList = (
    el: HTMLElement,
    app: App,
    manifest: PluginManifest,
    ctx: MarkdownPostProcessorContext,
    tags: Map<string, Tag[]>,
    hashTags: Map<string, ImagePath[]>,
    source: string,
) => {
    const root = createRoot(el);
    root.render(
        <StrictMode>
            <PhotoList
                app={app}
                manifest={manifest}
                ctx={ctx}
                tags={tags}
                hashTags={hashTags}
                source={source}
            />
        </StrictMode>,
    );
};
