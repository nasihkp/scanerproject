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

    // --- PRE-PROCESS: True Text Redaction via MuPDF WASM ---
    const redactionOps: any[] = [];
    const keys = Object.keys(fabricCanvasRegistry);
    for (const key of keys) {
        const pageIdx = parseInt(key) - 1; // 0-indexed for MuPDF
        const fCanvas = fabricCanvasRegistry[key as any];
        if (fCanvas) {
            const covers = fCanvas.getObjects().filter((o: any) => o.isOriginalTextCover);
            if (covers.length > 0) {
                const rects = covers.map((c: any) => ({
                    left: c.left,
                    top: c.top,
                    width: c.width * (c.scaleX || 1),
                    height: c.height * (c.scaleY || 1)
                }));
                redactionOps.push({ page: pageIdx, rects });
            }
        }
    }

    let mupdfSuccess = false;
    if (redactionOps.length > 0) {
        try {
            console.log("Applying native WASM redaction via MuPDF...");
            const mupdf = await import('mupdf');
            const mupdfBytes = new Uint8Array(originalBytes); // fresh copy for mupdf
            const mupdfDoc = mupdf.Document.openDocument(mupdfBytes, "application/pdf") as any;
            
            for (const op of redactionOps) {
                const page = mupdfDoc.loadPage(op.page) as any;
                for (const r of op.rects) {
                    const annot = page.createAnnotation("Redact");
                    annot.setRect([r.left, r.top, r.left + r.width, r.top + r.height]);
                }
                
                // applyRedactions(black_boxes, image_method, line_art_method, text_method)
                // Use generic enum values if TS complains about dynamic import types
                // REDACT_IMAGE_NONE = 0, REDACT_LINE_ART_NONE = 0, REDACT_TEXT_REMOVE = 0
                page.applyRedactions(
                    false, // No black boxes
                    0,     // Preserve images
                    0,     // Preserve vectors
                    0      // Remove text
                );
            }
            
            const outBuffer = mupdfDoc.saveToBuffer();
            arrayBuffer = outBuffer.buffer as ArrayBuffer;
            mupdfSuccess = true;
            console.log("MuPDF true text deletion successful.");
        } catch (err) {
            console.warn("MuPDF native redaction failed. Falling back to frontend whiteout covers.", err);
        }
    }
    // --------------------------------------------------------

    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();
    const base64Pngs: string[] = [];
    const allRedactions: { page: number, bounds: any[] }[] = [];

    for (let i = 1; i <= pageCount; i++) {
        const fCanvas = fabricCanvasRegistry[i];
        if (fCanvas) {
            const page = pdfDoc.getPage(i - 1);
            const { width: pWidth, height: pHeight } = page.getSize();
            const rawObjs = fCanvas.getObjects();
            const redactionBounds: any[] = [];

            // Heuristic for Strategy Selection
            // If there's original text extracted, it's Vector (Strategy 1).
            // Otherwise, it's Scanned (Strategy 2).
            const hasOriginalText = rawObjs.some((o: any) => o.isOriginalText);
            const isScanned = !hasOriginalText;
            console.log(`Page ${i}: ${isScanned ? 'Strategy 2 (Scanned/Flattened)' : 'Strategy 1 (Vector/Preserved)'}`);

            // 1. Identify Redactions
            rawObjs.forEach((obj: any) => {
                if (obj.isRedaction) {
                    redactionBounds.push({
                        left: obj.left,
                        top: obj.top,
                        width: obj.width * (obj.scaleX || 1),
                        height: obj.height * (obj.scaleY || 1)
                    });
                }
            });

            if (redactionBounds.length > 0) {
                allRedactions.push({ page: i, bounds: redactionBounds });
            }

            if (isScanned) {
                // STRATEGY 2: Scanned/Image PDF (Rasterize + Flatten)
                fCanvas.renderAll();
                const dataUrl = fCanvas.toDataURL({ format: 'png', multiplier: 2 });
                base64Pngs.push(dataUrl);
                const bgImg = await pdfDoc.embedPng(dataUrl);

                const newPage = pdfDoc.insertPage(i - 1, [pWidth, pHeight]);
                pdfDoc.removePage(i);
                newPage.drawImage(bgImg, { x: 0, y: 0, width: pWidth, height: pHeight });

                // Add invisible search layer
                await applyInvisibleLayer(pdfDoc, newPage, rawObjs, redactionBounds, pHeight);
            } else {
                // STRATEGY 1: Vector/Text PDF (Direct Object Modification + Transparent Overlay)
                // 1. Draw opaque whiteouts directly on top of original vector content for both redactions AND text covers
                rawObjs.forEach((obj: any) => {
                    // Skip redacting covers if MuPDF already successfully removed the text natively
                    if (obj.isOriginalTextCover && mupdfSuccess) return;

                    if (obj.isRedaction || obj.isOriginalTextCover) {
                        try {
                            page.drawRectangle({
                                x: obj.left,
                                y: pHeight - obj.top - (obj.height * (obj.scaleY || 1)),
                                width: obj.width * (obj.scaleX || 1),
                                height: obj.height * (obj.scaleY || 1),
                                color: rgb(1, 1, 1),
                            });
                        } catch (e) { console.error("Whiteout failed:", e); }
                    }
                });

                // 2. Add OCR break noise ONLY for redactions
                for (const rect of redactionBounds) {
                    try {
                        const noiseImg = await generateNoiseImage(pdfDoc, rect.width, rect.height);
                        page.drawImage(noiseImg, {
                            x: rect.left,
                            y: pHeight - rect.top - rect.height,
                            width: rect.width,
                            height: rect.height,
                        });
                    } catch (e) { console.error("Noise failed", e); }
                }

                // 3. Create a high-res transparent OVERLAY of all USER EDITS
                const hiddenObjs: any[] = [];
                const bgImage = fCanvas.backgroundImage;
                const bgColor = fCanvas.backgroundColor;

                if (bgImage) fCanvas.backgroundImage = null;
                fCanvas.backgroundColor = 'rgba(0,0,0,0)'; // Force transparency

                rawObjs.forEach((obj: any) => {
                    // Hide objects that are NOT user edits (original text, covers, redactions)
                    if (obj.isOriginalText || obj.isOriginalTextCover || obj.isRedaction) {
                        if (obj.visible !== false) {
                            obj.visible = false;
                            hiddenObjs.push(obj);
                        }
                    }
                });

                fCanvas.renderAll();
                const overlayDataUrl = fCanvas.toDataURL({ format: 'png', multiplier: 2 });

                // Restore UI visibility
                if (bgImage) fCanvas.setBackgroundImage(bgImage, fCanvas.renderAll.bind(fCanvas));
                fCanvas.backgroundColor = bgColor;
                hiddenObjs.forEach(obj => obj.visible = true);
                fCanvas.renderAll();

                // 4. Burn the overlay onto the PDF
                try {
                    const overlayImg = await pdfDoc.embedPng(overlayDataUrl);
                    page.drawImage(overlayImg, { x: 0, y: 0, width: pWidth, height: pHeight });
                } catch (e) { console.error("Overlay failed", e); }

                // 5. Apply the invisible layer for text and forms
                await applyInvisibleLayer(pdfDoc, page, rawObjs, redactionBounds, pHeight);

                base64Pngs.push(fCanvas.toDataURL());
            }
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
        if (obj.isRedaction || obj.isOriginalTextCover) continue;

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


