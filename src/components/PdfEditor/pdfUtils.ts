// We put pdfLib in an ambient declaration since it's from CDN
declare var PDFLib: any;

// Global registry to hold fabric canvases for each page
export const fabricCanvasRegistry: Record<number, any> = {};

export const createBlankPdf = async (): Promise<ArrayBuffer> => {
    if (!PDFLib) {
        throw new Error('PDFLib is not loaded');
    }
    const pdfDoc = await PDFLib.PDFDocument.create();
    // Add a blank standard letter size page (8.5 x 11 inches at 72 PPI is 612 x 792)
    pdfDoc.addPage([612, 792]);

    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer;
};

export const addBlankPageToPdf = async (file: File, afterIndex?: number): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    // Add a blank standard letter size page
    if (afterIndex !== undefined && afterIndex < pdfDoc.getPageCount()) {
        pdfDoc.insertPage(afterIndex + 1, [612, 792]);
    } else {
        pdfDoc.addPage([612, 792]);
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer;
};

export const deletePageFromPdf = async (file: File, pageIndex: number): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    if (pdfDoc.getPageCount() > 1) {
        pdfDoc.removePage(pageIndex);
    } else {
        throw new Error("Cannot delete the last page.");
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer;
};

export const duplicatePageInPdf = async (file: File, pageIndex: number): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [pageIndex]);
    pdfDoc.insertPage(pageIndex + 1, copiedPage);

    const pdfBytes = await pdfDoc.save();
    return pdfBytes.buffer;
};

export const saveEditedPdf = async (file: File, password?: string): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const form = pdfDoc.getForm();

    const pageCount = pdfDoc.getPageCount();

    for (let i = 1; i <= pageCount; i++) {
        const fCanvas = fabricCanvasRegistry[i];
        if (fCanvas) {
            const page = pdfDoc.getPage(i - 1);
            const rawObjs = fCanvas.getObjects();

            // Extract forms to map them via pdf-lib
            const formElements = rawObjs.filter((o: any) => o.isPdfForm);

            // Temporarily hide background and forms for overlay PNG export
            const bg = fCanvas.backgroundImage;
            fCanvas.setBackgroundImage(null, fCanvas.renderAll.bind(fCanvas));
            formElements.forEach((o: any) => { o.opacity = 0; });
            fCanvas.renderAll();

            // Only embed if there are actual objects, or just embed anyway (transparent if empty)
            if (fCanvas.getObjects().length > formElements.length) {
                const dataUrl = fCanvas.toDataURL({ format: 'png', multiplier: 3 });
                const pngImage = await pdfDoc.embedPng(dataUrl);

                page.drawImage(pngImage, {
                    x: 0,
                    y: 0,
                    width: page.getWidth(),
                    height: page.getHeight(),
                });
            }

            // Restore background and forms
            fCanvas.setBackgroundImage(bg, fCanvas.renderAll.bind(fCanvas));
            formElements.forEach((o: any) => { o.opacity = 1; });
            fCanvas.renderAll();

            // Map Forms using pdf-lib
            formElements.forEach((o: any, index: number) => {
                const width = o.width * (o.scaleX || 1);
                const height = o.height * (o.scaleY || 1);
                const x = o.left;
                const y = page.getHeight() - o.top - height;

                const fieldName = `field_p${i}_${index}_${Math.random().toString(36).substr(2, 5)}`;

                try {
                    if (o.formType === 'text') {
                        const textField = form.createTextField(fieldName);
                        textField.addToPage(page, { x, y, width, height });
                    } else if (o.formType === 'checkbox') {
                        const checkbox = form.createCheckBox(fieldName);
                        checkbox.addToPage(page, { x, y, width, height });
                    } else if (o.formType === 'radio') {
                        const radioGroup = form.createRadioGroup(fieldName);
                        radioGroup.addOptionToPage(`opt_${index}`, page, { x, y, width, height });
                    }
                } catch (e) {
                    console.error("Failed to add form field", e);
                }
            });
        }
    }

    const saveOptions: any = {};
    if (password) {
        // As of pdf-lib ^1.17, document encryption is built via setProducer/encrypt methods or userPassword save options
        // We pass it to the save options
        saveOptions.userPassword = password;
        saveOptions.ownerPassword = password;
        saveOptions.useObjectStreams = false; // required for encryption natively in some pdf-lib envs
    }

    const pdfBytes = await pdfDoc.save(saveOptions);
    return pdfBytes.buffer;
};
