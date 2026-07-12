import { App, MarkdownPostProcessorContext, Menu, TFile } from 'obsidian';
import { MouseEventHandler, StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import 'photoswipe/dist/photoswipe.css';

import { ImagePath, Tag } from './tagger';

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
};

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
        let lightbox: PhotoSwipeLightbox | null = new PhotoSwipeLightbox({
            gallery: '#' + galleryId,
            children: 'a',
            pswpModule: () => import('photoswipe'),
        });
        lightbox.init();

        return () => {
            if (lightbox) {
                lightbox.destroy();
            }
            lightbox = null;
        };
    }, [galleryId]);

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

                return (
                    <a
                        href={image.resourcePath}
                        data-pswp-width={image.width}
                        data-pswp-height={image.height}
                        key={galleryId + '-' + index}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <img
                            src={image.resourcePath}
                            alt=""
                            onContextMenu={handleImageContextMenu}
                        />
                    </a>
                );
            })}
        </div>
    );
};

interface PhotoListProps {
    app: App;
    ctx: MarkdownPostProcessorContext;
    tags: Map<string, Tag[]>;
    hashTags: Map<string, ImagePath[]>;
    source: string;
}

const PhotoList = ({ app, ctx, tags, hashTags, source }: PhotoListProps) => {
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
        const currentFile = app.vault.getAbstractFileByPath(ctx.sourcePath);

        if (!(currentFile instanceof TFile)) {
            return;
        }

        const foundPhotos: Photo[] = [];

        if (isHashtagType) {
            const hashtagPhotos = hashTags.get(currentFile.basename);
            if (!hashtagPhotos) {
                return;
            }

            for (const { path, imageWidth, imageHeight } of hashtagPhotos) {
                const image = app.vault.getAbstractFileByPath(path);
                if (!(image instanceof TFile)) {
                    continue;
                }

                foundPhotos.push({
                    resourcePath: app.vault.getResourcePath(image),
                    path,
                    width: imageWidth,
                    height: imageHeight,
                });
            }
        } else {
            for (const [imagePath, fileTags] of tags.entries()) {
                const tag = fileTags.find((tag) => tag.filePath === currentFile.path);
                if (tag) {
                    const image = app.vault.getAbstractFileByPath(imagePath);
                    if (!(image instanceof TFile)) {
                        continue;
                    }

                    foundPhotos.push({
                        resourcePath: app.vault.getResourcePath(image),
                        path: imagePath,
                        width: tag.imageWidth,
                        height: tag.imageHeight,
                    });
                }
            }
        }

        setAllPhotos(foundPhotos);
    }, [app, ctx.sourcePath, tags]);

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
        return <PhotoGallery app={app} galleryId={baseGalleryId} photos={allPhotos} />;
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
    ctx: MarkdownPostProcessorContext,
    tags: Map<string, Tag[]>,
    hashTags: Map<string, ImagePath[]>,
    source: string,
) => {
    const root = createRoot(el);
    root.render(
        <StrictMode>
            <PhotoList app={app} ctx={ctx} tags={tags} hashTags={hashTags} source={source} />
        </StrictMode>,
    );
};
