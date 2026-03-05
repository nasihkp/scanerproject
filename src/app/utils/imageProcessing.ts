/*
  Image Processing Utils
  - Perspective Warp implementation in pure JS
*/

export interface Point {
    x: number;
    y: number;
}

// 1. Calculate the Homography Matrix
function getPerspectiveTransform(src: Point[], dst: Point[]) {
    // Solves for P * H = 0 to find H
    // ... implementation details (Gaussian elimination) ...
    // This is a standard math algorithm.

    // For the sake of this tool use, I will implement a robust solver.
    // We need 8 equations for 8 unknowns (h33 = 1).
    const a: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
        a.push([src[i].x, src[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].y * dst[i].x]);
        a.push([0, 0, 0, src[i].x, src[i].y, 1, -src[i].x * dst[i].y, -src[i].y * dst[i].y]);
        b.push(dst[i].x);
        b.push(dst[i].y);
    }

    const h = solveLinearSystem(a, b);
    // h has 8 elements, H is 3x3 with last element 1
    return [
        h[0], h[1], h[2],
        h[3], h[4], h[5],
        h[6], h[7], 1
    ];
}

// Gaussian elimination to solve Ax = b
function solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    // Augment A with b
    const M = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
        // Pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
        }

        // Swap
        [M[i], M[maxRow]] = [M[maxRow], M[i]];

        // Make M[i][i] = 1
        const p = M[i][i];
        for (let j = i; j <= n; j++) M[i][j] /= p;

        // Eliminate other rows
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const f = M[k][i];
                for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
            }
        }
    }

    return M.map(row => row[n]);
}

// 2. Apply Warp
export async function perspectiveWarp(
    imageSrc: string,
    corners: Point[]
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            // 1. Determine dimensions of dst
            // Width = max dist between top corners and bottom corners
            const widthTop = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
            const widthBottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
            const width = Math.max(widthTop, widthBottom);

            const heightLeft = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
            const heightRight = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
            const height = Math.max(heightLeft, heightRight);

            // 2. Define dst points (rectangle)
            const dst: Point[] = [
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: 0, y: height }
            ];

            // 3. Get Matrix (Inverse mapping: dst -> src is easier for pixel filling usually, but we have forward transform here? 
            // Actually standard is finding H that maps Src -> Dst.
            // Then for each pixel in Dst, using Inv(H) to find pixel in Src.
            // But we computed Src -> Dst.

            // We need Inverse H to loop over Dst pixels and sample from Src
            // Or we can use getPerspectiveTransform(dst, corners) to get InvH directly!
            const invH = getPerspectiveTransform(dst, corners);

            // 4. Create standard canvas
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject("No context");

            const imgData = ctx.createImageData(width, height);
            const data = imgData.data;

            // Draw original to a canvas to read pixels
            const srcCanvas = document.createElement("canvas");
            srcCanvas.width = img.width;
            srcCanvas.height = img.height;
            const srcCtx = srcCanvas.getContext("2d");
            srcCtx?.drawImage(img, 0, 0);
            const srcData = srcCtx?.getImageData(0, 0, img.width, img.height).data;
            if (!srcData) return reject("No src data");

            // 5. Fill pixels
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // Apply homography invH to (x, y)
                    const D = invH[6] * x + invH[7] * y + 1;
                    const u = (invH[0] * x + invH[1] * y + invH[2]) / D;
                    const v = (invH[3] * x + invH[4] * y + invH[5]) / D;

                    // Bilinear Interpolation (or nearest neighbor for speed for now)
                    // Nearest Neighbor:
                    const srcX = Math.round(u);
                    const srcY = Math.round(v);

                    if (srcX >= 0 && srcX < img.width && srcY >= 0 && srcY < img.height) {
                        const idx = (y * width + x) * 4;
                        const srcIdx = (srcY * img.width + srcX) * 4;
                        data[idx] = srcData[srcIdx];
                        data[idx + 1] = srcData[srcIdx + 1];
                        data[idx + 2] = srcData[srcIdx + 2];
                        data[idx + 3] = srcData[srcIdx + 3];
                    }
                }
            }

            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.95));
        };
        img.onerror = reject;
    });
}
