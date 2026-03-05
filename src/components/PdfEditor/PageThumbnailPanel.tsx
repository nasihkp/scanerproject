import React from 'react';
import { PdfEditorState, Action } from './PdfEditorState';
import { GripVertical, X, Plus, Trash2, Copy } from 'lucide-react';
import { addBlankPageToPdf, deletePageFromPdf, duplicatePageInPdf } from './pdfUtils';

interface PageThumbnailPanelProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
}

export const PageThumbnailPanel: React.FC<PageThumbnailPanelProps> = ({ state, dispatch }) => {
    if (!state.thumbnailPanelOpen) return null;

    const numPages = state.document?.numPages || 0;

    return (
        <div className="w-48 bg-[#151515] border-r border-white/10 flex-shrink-0 flex flex-col h-full absolute md:relative z-10 transition-transform">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Pages</h3>
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_THUMBNAIL_PANEL' })}
                    className="text-white/50 hover:text-white md:hidden"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {numPages > 0 ? (
                    <>
                        {Array.from({ length: numPages }).map((_, i) => (
                            <div
                                key={i}
                                className="flex flex-col items-center gap-2 group cursor-pointer relative"
                            >
                                <div className="relative w-32 aspect-[1/1.414] bg-white rounded shadow-sm border-2 border-transparent group-hover:border-[#3b82f6]/50 transition-colors flex items-center justify-center overflow-hidden">
                                    <span className="text-gray-300 text-3xl font-bold opacity-20">{i + 1}</span>

                                    {/* Drag Handle */}
                                    <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white rounded cursor-grab active:cursor-grabbing p-0.5" title="Drag to reorder (Coming soon)">
                                        <GripVertical size={14} />
                                    </div>

                                    {/* Duplicate Button */}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!state.document?.file) return;
                                            try {
                                                const newBytes = await duplicatePageInPdf(state.document.file, i);
                                                const newFile = new File([newBytes], state.document.fileName, { type: 'application/pdf' });
                                                dispatch({ type: 'SET_DOCUMENT', payload: { ...state.document, file: newFile, fileSize: newFile.size, numPages: state.document.numPages + 1 } });
                                            } catch (err: any) {
                                                alert(err.message || 'Failed to duplicate page');
                                            }
                                        }}
                                        className="absolute right-1 top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-[#3b82f6]/80 text-white p-1 rounded hover:bg-[#3b82f6]" title="Duplicate Page">
                                        <Copy size={12} />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!state.document?.file) return;
                                            try {
                                                const newBytes = await deletePageFromPdf(state.document.file, i);
                                                const newFile = new File([newBytes], state.document.fileName, { type: 'application/pdf' });
                                                dispatch({ type: 'SET_DOCUMENT', payload: { ...state.document, file: newFile, fileSize: newFile.size, numPages: state.document.numPages - 1 } });
                                            } catch (err: any) {
                                                alert(err.message || 'Failed to delete page');
                                            }
                                        }}
                                        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 text-white p-1 rounded hover:bg-red-600" title="Delete Page">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                <span className="text-xs text-white/50 font-medium">{i + 1}</span>
                            </div>
                        ))}
                        <button
                            onClick={async () => {
                                if (!state.document?.file) return;
                                try {
                                    const newBytes = await addBlankPageToPdf(state.document.file);
                                    const newFile = new File([newBytes], state.document.fileName, { type: 'application/pdf' });
                                    dispatch({ type: 'SET_DOCUMENT', payload: { ...state.document, file: newFile, fileSize: newFile.size, numPages: state.document.numPages + 1 } });
                                } catch (err) {
                                    alert('Failed to add page');
                                }
                            }}
                            className="w-32 aspect-[1/1.414] border-2 border-dashed border-white/20 rounded flex flex-col items-center justify-center text-white/40 hover:text-white/70 hover:border-white/40 transition-colors mx-auto mt-2"
                        >
                            <Plus size={24} className="mb-2" />
                            <span className="text-xs font-medium">Add Page</span>
                        </button>
                    </>
                ) : (
                    <div className="text-center text-xs text-white/30 mt-10">No pages yet</div>
                )}
            </div>
        </div>
    );
};
