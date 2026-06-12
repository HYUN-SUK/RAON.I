import { compressImage as standardCompressImage } from './imageCompressor';

/**
 * Legacy wrapper forwarding calls to the standard imageCompressor.
 * This ensures backwards compatibility and consistent compression across the app.
 */
export const compressImage = async (file: File): Promise<File> => {
    return standardCompressImage(file);
};
