import React from 'react';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { TopBar } from './TopBar';
import { CenterCanvas } from './CenterCanvas';
import { PageThumbnailPanel } from './PageThumbnailPanel';
import { BottomToolbar } from './BottomToolbar';
import { pdfEditorReducer, initialState } from './PdfEditorState';

interface PdfEditorProps {
    onClose: () => void;
    initialFile?: File;
    onSave?: (pdfBytes: Uint8Array, fileName: string) => void;
}

export const PdfEditor: React.FC<PdfEditorProps> = ({ onClose, initialFile, onSave }) => {
    const [state, dispatch] = React.useReducer(pdfEditorReducer, initialState);

    React.useEffect(() => {
        if (initialFile) {
            dispatch({
                type: 'SET_DOCUMENT',
                payload: {
                    file: initialFile,
                    numPages: 0,
                    fileName: initialFile.name,
                    fileSize: initialFile.size,
                },
            });
        }
    }, [initialFile]);

    return (
        <div className="flex flex-col h-screen w-full bg-[#0f0f0f] text-white overflow-hidden font-sans">
            <TopBar state={state} dispatch={dispatch} onClose={onClose} onSave={onSave} />

            <div className="flex flex-1 overflow-hidden relative">
                <div className="hidden md:flex h-full">
                    <LeftSidebar state={state} dispatch={dispatch} />
                </div>

                {/* Page Thumbnail Panel */}
                <div className="hidden md:flex h-full">
                    <PageThumbnailPanel state={state} dispatch={dispatch} />
                </div>

                <CenterCanvas state={state} dispatch={dispatch} />

                <div className="hidden md:flex h-full">
                    <RightSidebar state={state} dispatch={dispatch} />
                </div>

                <BottomToolbar state={state} dispatch={dispatch} />
            </div>
        </div>
    );
};
