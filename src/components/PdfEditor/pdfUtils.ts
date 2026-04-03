import { rgb, PDFDocument, StandardFonts, PDFPage } from 'pdf-lib';
// State types imported as needed from PdfEditorState


// We put fabric in an ambient declaration since it's from CDN
declare var fabric: any;

// Global registry to hold fabric canvases for each page
export const fabricCanvasRegistry: Record<number, any> = {};

export const createBlankPdf = async (): Promise<ArrayBuffer> => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer as ArrayBuffer;
};

export const addBlankPageToPdf = async (file: File, afterIndex?: number): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    if (afterIndex !== undefined && afterIndex < pdfDoc.getPageCount()) {
        pdfDoc.insertPage(afterIndex + 1, [612, 792]);
    } else {
        pdfDoc.addPage([612, 792]);
    }
    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer as ArrayBuffer;
};

export const deletePageFromPdf = async (file: File, pageIndex: number): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    if (pdfDoc.getPageCount() > 1) {
        pdfDoc.removePage(pageIndex);
    } else {
        throw new Error("Cannot delete the last page.");
    }
    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer as ArrayBuffer;
};

export const duplicatePageInPdf = async (file: File, pageIndex: number): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [pageIndex]);
    pdfDoc.insertPage(pageIndex + 1, copiedPage);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer as ArrayBuffer;
};

export const saveEditedPdf = async (file: File, password?: string): Promise<{ pdfBytes: Uint8Array, base64Pngs: string[], metadata: any }> => {
    // Read file once into a Uint8Array – make separate copies for each consumer
    // to avoid "detached ArrayBuffer" errors when mupdf transfers ownership.
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    let arrayBuffer: ArrayBuffer = originalBytes.buffer as ArrayBuffer;

    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();
    const base64Pngs: string[] = [];
    const allRedactions: { page: number, bounds: any[] }[] = [];

    const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= pageCount; i++) {
        const fCanvas = fabricCanvasRegistry[i];
        if (fCanvas) {
            const page = pdfDoc.getPage(i - 1);
            const { width: pWidth, height: pHeight } = page.getSize();
            const rawObjs = fCanvas.getObjects();
            const redactionBounds: any[] = [];

            // STRATEGY: Full Page Reconstruction (No background)
            const objects = fCanvas.getObjects();
            
            // 1. Draw a white background covering the original page content completely
            page.drawRectangle({
                x: 0, y: 0, width: pWidth, height: pHeight,
                color: rgb(1, 1, 1)
            });

            // 2. Draw all decomposed objects onto the page
            for (const obj of objects) {
                const width = obj.width * (obj.scaleX || 1);
                const height = obj.height * (obj.scaleY || 1);
                const x = obj.left;
                const y = pHeight - obj.top - height;

                if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
                    const fontSize = (obj.fontSize || 12) * (obj.scaleY || 1);
                    try {
                        page.drawText(obj.text, {
                            x: obj.left,
                            y: pHeight - obj.top - fontSize,
                            size: fontSize,
                            font: standardFont,
                            color: rgb(0, 0, 0), // Default to black for now
                        });
                    } catch (e) { }
                } 
                else if (obj.type === 'image') {
                    try {
                        const dataUrl = obj.toDataURL();
                        const img = await pdfDoc.embedPng(dataUrl);
                        page.drawImage(img, { x, y, width, height });
                    } catch (e) { }
                }
                else if (obj.type === 'rect') {
                    try {
                        page.drawRectangle({
                            x, y, width, height,
                            color: rgb(0.8, 0.8, 0.8), // Placeholder for color extraction
                            borderColor: rgb(0, 0, 0),
                            borderWidth: obj.strokeWidth || 0,
                        });
                    } catch (e) { }
                }
            }

            base64Pngs.push(fCanvas.toDataURL());

        }
    }

    // Embed Metadata
    const metadata = { erased: true, regions: allRedactions };
    pdfDoc.setSubject(JSON.stringify(metadata));
    pdfDoc.setProducer('SmartScan Anti-Gravity Engine');

    const saveOptions: any = {};
    if (password) {
        saveOptions.userPassword = password;
        saveOptions.ownerPassword = password;
        saveOptions.useObjectStreams = false;
    }

    const pdfBytes = await pdfDoc.save(saveOptions);
    return { pdfBytes, base64Pngs, metadata };
};

async function generateNoiseImage(pdfDoc: any, width: number, height: number) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(w, h);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const val = Math.random() * 255;
        imageData.data[i] = val;
        imageData.data[i + 1] = val;
        imageData.data[i + 2] = val;
        imageData.data[i + 3] = 40;
    }
    ctx.putImageData(imageData, 0, 0);
    return await pdfDoc.embedPng(canvas.toDataURL());
}

// Helper to apply invisible search layers and PDF form elements
async function applyInvisibleLayer(pdfDoc: any, page: any, rawObjs: any[], redactionBounds: any[], pHeight: number) {
    const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const form = pdfDoc.getForm();

    for (const obj of rawObjs) {
        if (obj.isRedaction || obj.isOriginalTextCover || obj.isOriginalImage || obj.isOriginalImageCover) continue;

        const width = obj.width * (obj.scaleX || 1);
        const height = obj.height * (obj.scaleY || 1);
        const x = obj.left;
        const y = pHeight - obj.top - height;

        const isRedacted = redactionBounds.some(rect => {
            return (x < rect.left + rect.width && x + width > rect.left && obj.top < rect.top + rect.height && obj.top + height > rect.top);
        });

        if (isRedacted) continue;

        // 1. Invisible Search Layer (Original and User text)
        const isText = obj.isOriginalText || obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text';
        if (isText && obj.text && obj.text.trim().length > 0) {
            const fontSize = (obj.fontSize || 12) * (obj.scaleY || 1);
            try {
                page.drawText(obj.text, {
                    x: obj.left,
                    y: pHeight - obj.top - fontSize,
                    size: fontSize,
                    font: standardFont,
                    opacity: 0, // ALWAYS invisible, visuals provided by original vector or transparent overlay
                });
            } catch (e) { }
        }

        // 2. Interactive Form Fields
        if (obj.isPdfForm) {
            const fieldName = `field_${Math.random().toString(36).substr(2, 5)}`;
            try {
                if (obj.formType === 'text') {
                    const textField = form.createTextField(fieldName);
                    textField.addToPage(page, { x, y, width, height });
                } else if (obj.formType === 'checkbox') {
                    const checkbox = form.createCheckBox(fieldName);
                    checkbox.addToPage(page, { x, y, width, height });
                }
            } catch (e) { }
        }
    }
}


