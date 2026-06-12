/**
 * Utility for client-side image compression using browser Canvas API.
 * This does not require any external package and runs at zero cost.
 */
export async function compressImage(file: File, maxDimension: number = 1024, quality: number = 0.75): Promise<File> {
  // Check if browser environment
  if (typeof window === 'undefined') {
    return file;
  }

  // If file is smaller than 300KB, skip compression to save processing time
  if (file.size < 300 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback to original if context not supported
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // WebP format is preferred, fall back to JPEG
        const mimeType = 'image/webp';
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            
            // Create a new File from Blob
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: mimeType,
              lastModified: Date.now(),
            });
            
            // Return compressed file if it is actually smaller, otherwise fallback to original
            if (compressedFile.size < file.size) {
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          mimeType,
          quality
        );
      };
      
      img.onerror = (err) => {
        reject(err);
      };
    };
    
    reader.onerror = (err) => {
      reject(err);
    };
  });
}
