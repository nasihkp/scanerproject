import React, { useState } from 'react';
import { PdfEditorState, Action } from './PdfEditorState';
import { PdfPageRenderer } from './PdfPageRenderer';
import { CreationMode } from './CreationMode';
import { createBlankPdf } from './pdfUtils';

// We put pdfjsLib in an ambient declaration since it's from CDN
declare var pdfjsLib: any;

interface CenterCanvasProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
}

export const CenterCanvas: React.FC<CenterCanvasProps> = ({ state, dispatch }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);

    const lastProcessedFileRef = React.useRef<File | null>(null);

    React.useEffect(() => {
        if (state.document?.file && state.document.file !== lastProcessedFileRef.current) {
            const processNewFile = async () => {
                try {
                    const arrayBuffer = await state.document!.file!.arrayBuffer();
                    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                    const loadedPdf = await loadingTask.promise;
                    setPdfDoc(loadedPdf);
                    lastProcessedFileRef.current = state.document!.file!;

                    if (loadedPdf.numPages !== state.document!.numPages) {
                        dispatch({
                            type: 'SET_DOCUMENT',
                            payload: {
                                ...state.document!,
                                numPages: loadedPdf.numPages,
                            },
                        });
                    }
                } catch (err) {
                    console.error("Error loading PDF from state change:", err);
                }
            };
            processNewFile();
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
            alert("Failed to create blank PDF. Is pdf-lib loaded?");
        }
    };

    return (
        <div className="flex-1 bg-[#2a2a2a] overflow-auto flex items-start justify-center relative shadow-inner p-4 pb-24 md:p-8">
            {/* Grid Overlay Placeholder */}
            <div className="absolute inset-0 pattern-grid opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            {state.document && pdfDoc ? (
                <div className="flex flex-col items-center w-full min-h-full" style={{ transform: `scale(1)`, transformOrigin: 'top center' }}>
                    {Array.from({ length: state.document.numPages }).map((_, i) => (
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
