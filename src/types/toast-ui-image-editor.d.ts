declare module '@toast-ui/react-image-editor' {
    import { Component } from 'react';

    interface ImageEditorProps {
        includeUI?: {
            loadImage?: {
                path: string;
                name: string;
            };
            theme?: Record<string, string>;
            menu?: string[];
            initMenu?: string;
            uiSize?: {
                width: string;
                height: string;
            };
            menuBarPosition?: string;
            locale?: Record<string, string>;
        };
        cssMaxHeight?: number;
        cssMaxWidth?: number;
        selectionStyle?: {
            cornerSize?: number;
            rotatingPointOffset?: number;
        };
        usageStatistics?: boolean;
    }

    export default class ImageEditor extends Component<ImageEditorProps> {
        getInstance(): {
            toDataURL(): string;
            clearObjects(): void;
            loadImageFromURL(path: string, name: string): Promise<void>;
        };
    }
}
