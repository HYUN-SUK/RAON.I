export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
        image.src = url
    })

export function getRadianAngle(degreeValue: number) {
    return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
export function rotateSize(width: number, height: number, rotation: number) {
    const rotRad = getRadianAngle(rotation)

    return {
        width:
            Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
        height:
            Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    }
}

/**
 * This function handles rotation and cropping of the image.
 * Uses a 2-canvas approach to ensure accurate coordinate mapping.
 */
export default async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number } | null,
    rotation = 0,
    flip = { horizontal: false, vertical: false }
): Promise<string | null> {
    const image = await createImage(imageSrc)

    const rotRad = getRadianAngle(rotation)

    // 1. Calculate bounding box of the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
        image.width,
        image.height,
        rotation
    )

    // 2. Create a temporary canvas to draw the rotated image
    const bBoxCanvas = document.createElement('canvas')
    bBoxCanvas.width = bBoxWidth
    bBoxCanvas.height = bBoxHeight
    const bCtx = bBoxCanvas.getContext('2d')

    if (!bCtx || !pixelCrop) {
        return null
    }

    // 3. Draw rotated image on temp canvas
    bCtx.translate(bBoxWidth / 2, bBoxHeight / 2)
    bCtx.rotate(rotRad)
    bCtx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
    bCtx.translate(-image.width / 2, -image.height / 2)
    bCtx.drawImage(image, 0, 0)

    // 4. Create the final canvas for the cropped area
    const canvas = document.createElement('canvas')
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null;
    }

    // 5. Draw the specific cropped area from the temp canvas to the final canvas
    ctx.drawImage(
        bBoxCanvas,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    )

    // 6. Return result as Blob URL
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(URL.createObjectURL(blob));
            } else {
                resolve(null);
            }
        }, 'image/png');
    });
}
