import { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import 'photoswipe/dist/photoswipe.css';
import { Gallery, Item } from 'react-photoswipe-gallery';

import { Tag } from './tagger';

interface PhotoListProps {
    app: App;
    ctx: MarkdownPostProcessorContext;
    tags: Map<string, Tag[]>;
}

const PhotoListComponent = ({ app, ctx, tags }: PhotoListProps) => {
    const [photos, setPhotos] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentFile = app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(currentFile instanceof TFile)) {
            setLoading(false);

            return;
        }

        const foundPhotos: string[] = [];
        for (const [imagePath, fileTags] of tags.entries()) {
            const isTagged = fileTags.some((tag) => tag.filePath === currentFile.path);
            if (isTagged) {
                foundPhotos.push(imagePath);
            }
        }
        setPhotos(foundPhotos);
        setLoading(false);
    }, [app, ctx.sourcePath, tags]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (photos.length === 0) {
        return <p>No photos found for this person.</p>;
    }

    return (
        <Gallery>
            {photos.map((photoPath) => {
                const file = app.vault.getAbstractFileByPath(photoPath);
                if (!(file instanceof TFile)) {
                    return null;
                }

                const imageSrc = app.vault.getResourcePath(file);

                return (
                    <Item
                        key={photoPath}
                        original={imageSrc}
                        thumbnail={imageSrc}
                        width="1024"
                        height="768"
                    >
                        {({ ref, open }) => (
                            <img
                                ref={ref}
                                onClick={open}
                                src={imageSrc}
                                alt={file.basename}
                            />
                        )}
                    </Item>
                );
            })}
        </Gallery>
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
