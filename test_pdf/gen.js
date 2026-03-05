const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');

async function createComplexPdf() {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Page 1
    const page1 = pdfDoc.addPage([500, 700]);
    page1.drawText('This is a complex test PDF', {
        x: 50,
        y: 650,
        size: 30,
        font: timesRomanFont,
        color: rgb(0, 0.53, 0.71),
    });

    // Page 2
    const page2 = pdfDoc.addPage([500, 700]);
    page2.drawText('Page 2: Multiple pages allow us to test the overlay engine safely.', { x: 50, y: 650, size: 15 });

    // Page 3
    const page3 = pdfDoc.addPage([500, 700]);
    page3.drawText('Page 3: Ensuring the background overlay is non-destructive.', { x: 50, y: 650, size: 15 });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('../public/complex_test.pdf', pdfBytes);
    console.log('PDF Created Successfully!');
}

createComplexPdf();
