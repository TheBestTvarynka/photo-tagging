import { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

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
        <ul>
            {photos.map((photoPath) => (
                <li key={photoPath}>
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            app.workspace
                                .openLinkText(photoPath, '', true)
                                .catch((err) => console.error(err));
                        }}
                    >
                        {photoPath}
                    </a>
                </li>
            ))}
        </ul>
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
