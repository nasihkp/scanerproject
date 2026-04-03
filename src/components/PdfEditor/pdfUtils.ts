import { rgb, PDFDocument, StandardFonts, Color } from 'pdf-lib';
// State types imported as needed from PdfEditorState

// We put fabric in an ambient declaration since it's from CDN
declare var fabric: any;

// Global registry to hold fabric canvases for each page
export const fabricCanvasRegistry: Record<number, any> = {};

// Helper to convert hex to pdf-lib RGB
const hexToRgb = (hex: string): Color => {
    if (!hex || hex === 'transparent') return rgb(0, 0, 0);
    if (hex.startsWith('rgb')) {
        const matches = hex.match(/\d+/g);
        if (matches && matches.length >= 3) {
            return rgb(parseInt(matches[0]) / 255, parseInt(matches[1]) / 255, parseInt(matches[2]) / 255);
        }
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
};

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
            
            // 1. Draw a white background covering original content
            page.drawRectangle({
                x: 0, y: 0, width: pWidth, height: pHeight,
                color: rgb(1, 1, 1)
            });

            const objects = fCanvas.getObjects();
            for (const obj of objects) {
                // Skip internal covers or redactions if they are just visual aids
                if (obj.isOriginalTextCover || obj.isOriginalImageCover) continue;

                const width = obj.width * (obj.scaleX || 1);
                const height = obj.height * (obj.scaleY || 1);
                const x = obj.left;
                const y = pHeight - obj.top - height;

                if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
                    const fontSize = (obj.fontSize || 12) * (obj.scaleY || 1);
                    const textColor = hexToRgb(obj.fill || '#000000');
                    try {
                        page.drawText(obj.text, {
                            x: obj.left,
                            y: pHeight - obj.top - fontSize,
                            size: fontSize,
                            font: standardFont,
                            color: textColor,
                            opacity: obj.opacity ?? 1,
                        });
                    } catch (e) { }
                } 
                else if (obj.type === 'image') {
                    try {
                        // For images, we take the current visual state from Fabric
                        const dataUrl = obj.toDataURL({
                            format: 'png',
                            quality: 1,
                        });
                        const img = await pdfDoc.embedPng(dataUrl);
                        
                        // Fabric's toDataURL includes rotation and flips if called on the object
                        // But wait, obj.toDataURL() on an image object in Fabric gives the CROPPED/TRANSFORMED image data
                        // So we can draw it flat.
                        page.drawImage(img, {
                            x: obj.left,
                            y: pHeight - obj.top - height,
                            width: width,
                            height: height,
                            opacity: obj.opacity ?? 1,
                        });
                    } catch (e) { }
                }
                else if (obj.type === 'rect') {
                    try {
                        page.drawRectangle({
                            x, y, width, height,
                            color: obj.fill && obj.fill !== 'transparent' ? hexToRgb(obj.fill) : undefined,
                            borderColor: obj.stroke ? hexToRgb(obj.stroke) : undefined,
                            borderWidth: obj.strokeWidth || 0,
                            opacity: obj.opacity ?? 1,
                            borderOpacity: obj.opacity ?? 1,
                        });
                    } catch (e) { }
                }
                else if (obj.type === 'circle') {
                    try {
                        const radius = (obj.radius || 0) * (obj.scaleX || 1);
                        page.drawCircle({
                            x: obj.left + radius,
                            y: pHeight - obj.top - radius,
                            size: radius,
                            color: obj.fill && obj.fill !== 'transparent' ? hexToRgb(obj.fill) : undefined,
                            borderColor: obj.stroke ? hexToRgb(obj.stroke) : undefined,
                            borderWidth: obj.strokeWidth || 0,
                            opacity: obj.opacity ?? 1,
                            borderOpacity: obj.opacity ?? 1,
                        });
                    } catch (e) { }
                }
                else if (obj.type === 'path') {
                    // Primitive path support (e.g. for pen/highlighter)
                    try {
                        const dataUrl = obj.toDataURL();
                        const img = await pdfDoc.embedPng(dataUrl);
                        page.drawImage(img, {
                            x: obj.left,
                            y: pHeight - obj.top - height,
                            width, height,
                            opacity: obj.opacity ?? 1,
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

// Functions generateNoiseImage and applyInvisibleLayer were removed as they were unreferenced internal helpers.
