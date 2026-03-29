import React, { useState } from 'react';
import { PdfEditorState, Action } from './PdfEditorState';
import { PdfPageRenderer } from './PdfPageRenderer';
import { CreationMode } from './CreationMode';
import { createBlankPdf } from './pdfUtils';

// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface CenterCanvasProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
}

export const CenterCanvas: React.FC<CenterCanvasProps> = ({ state, dispatch }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [bgPdfDoc, setBgPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const lastProcessedFileRef = React.useRef<File | null>(null);

    React.useEffect(() => {
        if (state.document?.file && state.document.file !== lastProcessedFileRef.current) {
            const fileToProcess = state.document.file;
            lastProcessedFileRef.current = fileToProcess;

            const processNewFile = async () => {
                try {
                    // Reset pages on new file
                    setPdfDoc(null);
                    setBgPdfDoc(null);
                    setNumPages(0);
                    setIsLoading(true);

                    console.log("Loading original PDF document...");
                    
                    // Read file bytes ONCE into a Uint8Array, then make independent 
                    // copies for each consumer to avoid "detached ArrayBuffer" errors.
                    // pdfjsLib.getDocument() transfers (detaches) the buffer it receives,
                    // so each call needs its own copy.
                    const fileBytes = new Uint8Array(await fileToProcess.arrayBuffer());
                    
                    // Copy for pdfjs initial load
                    const pdfJsBuffer = new Uint8Array(fileBytes);
                    
                    // 1. Load original document for immediate display
                    const loadingTask = pdfjsLib.getDocument({ data: pdfJsBuffer });
                    const loadedPdf = await loadingTask.promise;
                    console.log("Original PDF loaded successfully, pages:", loadedPdf.numPages);
                    
                    // Immediate update for "Instant Open" experience
                    setPdfDoc(loadedPdf);
                    setNumPages(loadedPdf.numPages);
                    setBgPdfDoc(loadedPdf); // Initial fallback is the original doc itself
                    setIsLoading(false); // Stop loader early

                    // Update global state immediately
                    dispatch({
                        type: 'SET_DOCUMENT',
                        payload: {
                            file: fileToProcess,
                            numPages: loadedPdf.numPages,
                            fileName: fileToProcess.name,
                            fileSize: fileToProcess.size,
                            bgPdfDoc: loadedPdf,
                        },
                    });

                    // 2. BACKGROUND TASK: Generate textless structural buffer using MuPDF WASM
                    // This happens while the user already sees the PDF
                    const processBackground = async () => {
                        try {
                            // Use a FRESH copy of the original bytes — the previous buffer
                            // was consumed/detached by pdfjsLib.getDocument above.
                            const muPdfBuffer = new Uint8Array(fileBytes);
                            console.log("Attempting to generate textless background layer via MuPDF WASM...");
                            
                            const mupdf = await import('mupdf');
                            if (mupdf && mupdf.Document) {
                                console.log("MuPDF module imported, opening document...");
                                const mDoc = mupdf.Document.openDocument(muPdfBuffer, "application/pdf") as any;
                                const count = mDoc.countPages();
                                
                                for (let i = 0; i < count; i++) {
                                    const mPage = mDoc.loadPage(i) as any;
                                    const annot = mPage.createAnnotation("Redact");
                                    annot.setRect([-10000, -10000, 10000, 10000]); 
                                    mPage.applyRedactions(false, 0, 0, 0); 
                                }
                                
                                const outBuf = mDoc.saveToBuffer();
                                const textlessBuffer = new Uint8Array(outBuf);
                                
                                // Load the pure graphical textless document for background rendering
                                const bgLoadingTask = pdfjsLib.getDocument({ data: textlessBuffer });
                                const bgLoadedPdf = await bgLoadingTask.promise;
                                
                                setBgPdfDoc(bgLoadedPdf);
                                
                                // Update global state with the optimized background doc
                                dispatch({
                                    type: 'SET_DOCUMENT',
                                    payload: {
                                        file: fileToProcess,
                                        numPages: loadedPdf.numPages,
                                        fileName: fileToProcess.name,
                                        fileSize: fileToProcess.size,
                                        bgPdfDoc: bgLoadedPdf,
                                    },
                                });
                                console.log("Textless background layer generated and applied.");
                            }
                        } catch (mupdfErr) {
                            console.warn("Could not generate textless background via MuPDF (keeping original as fallback):", mupdfErr);
                        }
                    };
                    
                    processBackground();
                } catch (err) {
                    console.error("Error loading PDF from state change:", err);
                    setIsLoading(false);
                }
            };
            processNewFile();
        } else if (!state.document?.file) {
            // Document cleared
            setPdfDoc(null);
            setBgPdfDoc(null);
            setNumPages(0);
            setIsLoading(false);
            lastProcessedFileRef.current = null;
        }
    }, [state.document?.file, dispatch]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        dispatch({
            type: 'SET_DOCUMENT',
            payload: {
                file: file,
                numPages: 0,
                fileName: file.name,
                fileSize: file.size,
            },
        });
    };

    const handleCreateBlank = async () => {
        try {
            const blankPdfBytes = await createBlankPdf();
            const file = new File([blankPdfBytes], 'Untitled Document.pdf', { type: 'application/pdf' });
            dispatch({
                type: 'SET_DOCUMENT',
                payload: {
                    file: file,
                    numPages: 0,
                    fileName: file.name,
                    fileSize: file.size,
                },
            });
        } catch (err) {
            console.error("Error creating blank PDF:", err);
            alert("Failed to create blank PDF. Please try again.");
        }
    };

    return (
        <div className="flex-1 bg-[#2a2a2a] overflow-auto flex items-start justify-center relative shadow-inner p-4 pb-24 md:p-8">
            {/* Grid Overlay */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            {isLoading ? (
                <div className="flex items-center justify-center h-full w-full absolute inset-0">
                    <div className="text-white/40 text-sm flex flex-col items-center gap-3">
                        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full" />
                        <span>Loading PDF...</span>
                    </div>
                </div>
            ) : pdfDoc && numPages > 0 ? (
                <div className="flex flex-col items-center w-full min-h-full" style={{ transformOrigin: 'top center' }}>
                    {Array.from({ length: numPages }).map((_, i) => (
                        <PdfPageRenderer
                            key={i + 1}
                            pdfDoc={pdfDoc}
                            bgPdfDoc={bgPdfDoc}
                            pageNum={i + 1}
                            scale={state.viewport.zoom}
                            activeTool={state.activeTool}
                            dispatch={dispatch}
                            selectedElementProps={state.selectedElementProps}
                            selectedElementId={state.selectedElementId}
                            history={state.history}
                            historyIndex={state.historyIndex}
                        />
                    ))}
                </div>
            ) : (
                <CreationMode onFileUpload={handleFileUpload} onCreateBlank={handleCreateBlank} />
            )}
        </div>
    );
};
