import Tesseract from 'tesseract.js';

/**
 * Recognizes text from an image (or multiple images) using Tesseract.js.
 * Returns the combined text.
 */
export async function recognizeText(images: string[]): Promise<string> {
    try {
        const worker = await Tesseract.createWorker('eng');

        let combinedText = '';

        for (const image of images) {
            const ret = await worker.recognize(image);
            combinedText += ret.data.text + '\n';
        }

        await worker.terminate();
        return combinedText;
    } catch (error) {
        console.error("OCR Failed:", error);
        return "";
    }
}
