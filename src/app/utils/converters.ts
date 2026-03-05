import { Document, Packer, Paragraph, ImageRun, TextRun } from "docx";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";

/**
 * Export images to a Word Document (.docx)
 * Each image is placed on a new page.
 */
export const exportToWord = async (images: string[]): Promise<Blob> => {
    const children: (Paragraph)[] = [];

    for (const [index, imgData] of images.entries()) {
        // Convert base64 to Uint8Array/Buffer for docx
        const response = await fetch(imgData);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();

        // Create an ImageRun
        const imageRun = new ImageRun({
            data: buffer,
            transformation: {
                width: 600,
                height: 800,
            },
            type: "png", // Required by modern docx, assuming png/jpeg is handled or treated as such
        });

        children.push(new Paragraph({
            children: [imageRun],
        }));

        // Add page break if not last
        if (index < images.length - 1) {
            children.push(new Paragraph({
                children: [new TextRun({ break: 1 })]
            }));
        }
    }

    const doc = new Document({
        sections: [
            {
                properties: {},
                children: children,
            },
        ],
    });

    return await Packer.toBlob(doc);
};

/**
 * Export images to a PowerPoint Presentation (.pptx)
 * One image per slide.
 */
export const exportToPPT = async (images: string[]): Promise<Blob> => {
    const pptx = new PptxGenJS();

    for (const imgWithMeta of images) {
        const slide = pptx.addSlide();

        // "contain" sizing would be nice, but pptxgenjs usually takes x,y,w,h
        // We'll set it to fill the slide roughly
        slide.addImage({
            data: imgWithMeta,
            x: 0,
            y: 0,
            w: "100%",
            h: "100%",
            sizing: { type: "contain", w: "100%", h: "100%" }
        });
    }

    // Generate blob
    // writeFile return promise of void usually, write('blob') returns promise of blob
    return await pptx.write({ outputType: "blob" }) as Blob;
};

/**
 * Export text to Excel (.xlsx)
 * Dumps OCR text into cell A1.
 */
export const exportToExcel = (text: string): Blob => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[text]]); // Just dump text in A1

    // Or maybe parse lines?
    // const rows = text.split('\n').map(line => [line]);
    // const ws = XLSX.utils.aoa_to_sheet(rows);

    XLSX.utils.book_append_sheet(wb, ws, "Scanned Data");

    // Write key is 'array' or 'base64' usually, for browser 'array' is good to make blob
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: "application/octet-stream" });
};
