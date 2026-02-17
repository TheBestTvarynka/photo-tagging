import { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import 'photoswipe/dist/photoswipe.css';

import { Tag } from './tagger';

interface PhotoListProps {
    app: App;
    ctx: MarkdownPostProcessorContext;
    tags: Map<string, Tag[]>;
}

type Photo = {
    path: string;
    width: number;
    height: number;
};

const PhotoListComponent = ({ app, ctx, tags }: PhotoListProps) => {
    const galleryId = 'tbt';

    const [photos, setPhotos] = useState<Photo[]>([]);

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
    }, []);

    useEffect(() => {
        const currentFile = app.vault.getAbstractFileByPath(ctx.sourcePath);

        if (!(currentFile instanceof TFile)) {
            return;
        }

        const foundPhotos: Photo[] = [];
        for (const [imagePath, fileTags] of tags.entries()) {
            const tag = fileTags.find((tag) => tag.filePath === currentFile.path);
            if (tag) {
                const image = app.vault.getAbstractFileByPath(imagePath);
                if (!(image instanceof TFile)) {
                    continue;
                }

                foundPhotos.push({
                    path: app.vault.getResourcePath(image),
                    width: tag.imageWidth,
                    height: tag.imageHeight,
                });
            }
        }

        setPhotos(foundPhotos);
    }, [app, ctx.sourcePath, tags]);

    return (
        <div className="pswp-gallery" id={galleryId}>
            {photos.map((image, index) => (
                <a
                    href={image.path}
                    data-pswp-width={image.width}
                    data-pswp-height={image.height}
                    key={galleryId + '-' + index}
                    target="_blank"
                    rel="noreferrer"
                >
                    <img src={image.path} alt="" />
                </a>
            ))}
        </div>
    );
};

export const mountPhotoList = (
    el: HTMLElement,
    app: App,
    ctx: MarkdownPostProcessorContext,
    tags: Map<string, Tag[]>,
) => {
    const root = createRoot(el);
    root.render(
        <StrictMode>
            <PhotoListComponent app={app} ctx={ctx} tags={tags} />
        </StrictMode>,
    );
};
