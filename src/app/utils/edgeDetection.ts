export interface RectCrop {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Attempts to detect the document edges in an image using basic thresholding and contour approximation.
 * Returns a percentage-based crop object { x, y, width, height } (0-100).
 */
export async function detectDocumentEdges(imageSrc: string): Promise<RectCrop | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            const canvas = document.createElement("canvas");
            // Scale down for performance
            const maxDim = 512;
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const w = Math.floor(img.width * scale);
            const h = Math.floor(img.height * scale);

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve(null);
                return;
            }

            ctx.drawImage(img, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;

            // 1. Convert to grayscale & simple edge detection
            // We'll just look for the first and last "content" pixels in rows/cols
            // Assumption: Document contrast is significant against background

            let minX = w, minY = h, maxX = 0, maxY = 0;
            let foundPixels = false;

            // Simple threshold: if pixel is not "dark background" or "white background"?
            // Actually, scans usually have a document on a table.
            // Let's assume the document is "lighter" than the table or "different".
            // This is very rudimentary. A proper edge detection needs Sobel filters.
            // For this "V1" we will try to find the bounding box of non-uniform regions.

            // Better heuristic: Sobel Edge Detection
            const sobelData = new Float32Array(w * h);
            const grayscale = new Uint8Array(w * h);

            for (let i = 0; i < data.length; i += 4) {
                grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }

            // Compute gradients (simplified Sobel)
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;

                    // Horizontal gradient
                    const gx =
                        (-1 * grayscale[idx - w - 1]) + (1 * grayscale[idx - w + 1]) +
                        (-2 * grayscale[idx - 1]) + (2 * grayscale[idx + 1]) +
                        (-1 * grayscale[idx + w - 1]) + (1 * grayscale[idx + w + 1]);

                    // Vertical gradient
                    const gy =
                        (-1 * grayscale[idx - w - 1]) + (-2 * grayscale[idx - w]) + (-1 * grayscale[idx - w + 1]) +
                        (1 * grayscale[idx + w - 1]) + (2 * grayscale[idx + w]) + (1 * grayscale[idx + w + 1]);

                    const mag = Math.sqrt(gx * gx + gy * gy);
                    if (mag > 50) { // Threshold for "edge"
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        foundPixels = true;
                    }
                }
            }

            if (!foundPixels) {
                // Fallback to center 80%
                resolve({ x: 10, y: 10, width: 80, height: 80 });
                return;
            }

            // Add some padding
            const padding = 10;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(w, maxX + padding);
            maxY = Math.min(h, maxY + padding);

            resolve({
                x: (minX / w) * 100,
                y: (minY / h) * 100,
                width: ((maxX - minX) / w) * 100,
                height: ((maxY - minY) / h) * 100
            });
        };

        img.onerror = () => resolve(null);
    });
}
