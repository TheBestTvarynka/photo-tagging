import { App, MarkdownPostProcessorContext, Menu, TFile } from 'obsidian';
import { MouseEventHandler, StrictMode, useEffect, useState } from 'react';
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
    resourcePath: string;
    path: string;
    width: number;
    height: number;
};

const PhotoList = ({ app, ctx, tags }: PhotoListProps) => {
    const galleryId = 'taggedphotosgallery';

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
                    resourcePath: app.vault.getResourcePath(image),
                    path: imagePath,
                    width: tag.imageWidth,
                    height: tag.imageHeight,
                });
            }
        }

        setPhotos(foundPhotos);
    }, [app, ctx.sourcePath, tags]);

    return (
        <div className="pswp-gallery" id={galleryId}>
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

export const mountPhotoList = (
    el: HTMLElement,
    app: App,
    ctx: MarkdownPostProcessorContext,
    tags: Map<string, Tag[]>,
) => {
    const root = createRoot(el);
    root.render(
        <StrictMode>
            <PhotoList app={app} ctx={ctx} tags={tags} />
        </StrictMode>,
    );
};
