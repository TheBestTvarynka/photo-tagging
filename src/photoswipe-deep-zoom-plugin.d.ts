declare module 'photoswipe-deep-zoom-plugin' {
    import PhotoSwipeLightbox from 'photoswipe/lightbox';

    export type DeepZoomTileData = {
        element?: HTMLElement;
        tileUrl?: string;
        maxWidth?: number;
        maxHeight?: number;
        [key: string]: unknown;
    };

    export type PhotoSwipeDeepZoomOptions = {
        tileSize?: number;
        tileOverlap?: number;
        cacheLimit?: number;
        fadeInDuration?: number;
        maxTilePixelRatio?: number;
        useLowResLayer?: boolean;
        incrementalZoomButtons?: boolean;
        getTileUrlFn?: (data: DeepZoomTileData, x: number, y: number, z: number) => string;
    };

    export default class PhotoSwipeDeepZoom {
        constructor(lightbox: PhotoSwipeLightbox, options?: PhotoSwipeDeepZoomOptions);
    }
}
