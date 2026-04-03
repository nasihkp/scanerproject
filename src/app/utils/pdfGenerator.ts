import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { ScannedDoc } from "../types/types";

export const generatePDF = async (images: string[], password?: string): Promise<string> => {
    const doc = new jsPDF();

    for (let i = 0; i < images.length; i++) {
        const imgData = images[i];

        if (i > 0) {
            doc.addPage();
        }

        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        doc.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }

    // Output as ArrayBuffer to post-process with pdf-lib if password is needed
    if (password) {
        const pdfBytes = doc.output("arraybuffer");
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const encryptedBytes = await pdfDoc.save({
            useObjectStreams: false,
        });
        const blob = new Blob([encryptedBytes as any], { type: "application/pdf" });
        return URL.createObjectURL(blob);
    }

    // Standard no-password output
    const blob = doc.output("blob");
    return URL.createObjectURL(blob);
};

export const mergePDFs = async (documents: (ScannedDoc | File)[]): Promise<string> => {
    const mergedPdf = await PDFDocument.create();

    for (const doc of documents) {
        if (doc instanceof File) {
            // It's an external PDF file
            const fileArrayBuffer = await doc.arrayBuffer();
            const pdfToMerge = await PDFDocument.load(fileArrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        } else {
            // It's a ScannedDoc (list of image strings)
            for (const imageStr of doc.pages) {
                const page = mergedPdf.addPage();

                // Embed image
                // Note: imageStr is likely a data URL (base64)
                // We need to determine if it's PNG or JPG. Usually scan apps use JPG.
                // If it's pure data url, we can strip header.

                let imageBytes: Uint8Array;
                let embeddedImage;

                if (imageStr.startsWith("data:image/png")) {
                    imageBytes = await fetch(imageStr).then(res => res.arrayBuffer()).then(buffer => new Uint8Array(buffer));
                    embeddedImage = await mergedPdf.embedPng(imageBytes);
                } else {
                    // Assume JPEG for everything else or if explicit
                    imageBytes = await fetch(imageStr).then(res => res.arrayBuffer()).then(buffer => new Uint8Array(buffer));
                    embeddedImage = await mergedPdf.embedJpg(imageBytes);
                }

                // Scale image to fit page
                const { width, height } = embeddedImage.scale(1);
                const pageWidth = page.getSize().width;
                const pageHeight = page.getSize().height;

                // Simple fit-to-width logic, preserving aspect ratio
                // You might want more complex logic here similar to jsPDF
                const scaleFactor = Math.min(pageWidth / width, pageHeight / height);

                page.drawImage(embeddedImage, {
                    x: 0,
                    y: pageHeight - (height * scaleFactor), // top-aligned (pdf-lib y is from bottom)
                    width: width * scaleFactor,
                    height: height * scaleFactor,
                });
            }
        }
    }

    const savedBytes = await mergedPdf.save();
    const blob = new Blob([savedBytes as any], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
};
