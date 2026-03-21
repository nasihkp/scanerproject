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
                    setNumPages(0);
                    setIsLoading(true);

                    const arrayBuffer = await fileToProcess.arrayBuffer();
                    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                    const loadedPdf = await loadingTask.promise;
                    setPdfDoc(loadedPdf);
                    setNumPages(loadedPdf.numPages);

                    // Also update global state with page count
                    dispatch({
                        type: 'SET_DOCUMENT',
                        payload: {
                            file: fileToProcess,
                            numPages: loadedPdf.numPages,
                            fileName: fileToProcess.name,
                            fileSize: fileToProcess.size,
                        },
                    });
                } catch (err) {
                    console.error("Error loading PDF from state change:", err);
                } finally {
                    setIsLoading(false);
                }
            };
            processNewFile();
        } else if (!state.document?.file) {
            // Document cleared
            setPdfDoc(null);
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
