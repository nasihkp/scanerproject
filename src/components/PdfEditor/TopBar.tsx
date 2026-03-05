import React, { useState } from 'react';
import {
    ArrowLeft, Undo, Redo, ZoomIn, ZoomOut,
    PanelLeft, Monitor, Moon, Sun, Save, Download, Lock
} from 'lucide-react';
import { PdfEditorState, Action } from './PdfEditorState';
import { saveEditedPdf } from './pdfUtils';

interface TopBarProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
    onClose: () => void;
    onSave?: (pdfBytes: Uint8Array, fileName: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ state, dispatch, onClose, onSave }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState(state.document?.password || '');

    const handleSave = async () => {
        if (!state.document?.file) return;
        setIsSaving(true);
        try {
            const pdfBytes = await saveEditedPdf(state.document.file);
            const fileName = state.document.fileName || 'Untitled Document.pdf';

            if (onSave) {
                // Return to parent component instead of forcing browser download
                onSave(pdfBytes, fileName);
            } else {
                // Fallback browser download behavior
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `Edited_${fileName}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("Failed to save PDF", error);
            alert("Failed to save and export PDF");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordSave = () => {
        dispatch({ type: 'SET_PASSWORD', payload: passwordInput });
        setShowPasswordModal(false);
    };

    return (
        <>
            <div className="flex items-center justify-between px-4 h-14 bg-[#1a1a1a] border-b border-white/10 text-white shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-md transition-colors"
                        title="Back to Scanner App"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="font-medium text-sm truncate max-w-[200px]">
                        {state.document?.fileName || 'Untitled Document'}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => dispatch({ type: 'UNDO' })}
                        disabled={state.historyIndex < 0}
                        className={`p-2 rounded-md transition-colors ${state.historyIndex < 0 ? 'text-white/30 cursor-not-allowed' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                        title="Undo"
                    >
                        <Undo size={18} />
                    </button>
                    <button
                        onClick={() => dispatch({ type: 'REDO' })}
                        disabled={state.historyIndex >= state.history.length - 1}
                        className={`p-2 rounded-md transition-colors ${state.historyIndex >= state.history.length - 1 ? 'text-white/30 cursor-not-allowed' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                        title="Redo"
                    >
                        <Redo size={18} />
                    </button>

                    <div className="w-px h-6 bg-white/10 mx-2"></div>

                    <button
                        onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(0.5, state.viewport.zoom - 0.25) })}
                        className="p-2 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="Zoom Out">
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(state.viewport.zoom * 100)}%</span>
                    <button
                        onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(4.0, state.viewport.zoom + 0.25) })}
                        className="p-2 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="Zoom In">
                        <ZoomIn size={18} />
                    </button>

                    <div className="w-px h-6 bg-white/10 mx-2"></div>

                    <button
                        onClick={() => dispatch({ type: 'TOGGLE_THUMBNAIL_PANEL' })}
                        className={`p-2 rounded-md transition-colors ${state.thumbnailPanelOpen ? 'bg-blue-500/20 text-[#3b82f6]' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
                        title="Toggle Thumbnail Panel"
                    >
                        <PanelLeft size={18} />
                    </button>
                    <button
                        className="p-2 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors"
                        title="View Mode"
                    >
                        <Monitor size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors" title="Toggle Theme">
                        {state.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className={`p-2 rounded-md transition-colors ${state.document?.password ? 'text-green-400 bg-green-400/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                        title="Set Document Password"
                    >
                        <Lock size={18} />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !state.document}
                        className={`flex items-center gap-2 px-3 py-1.5 bg-[#3b82f6] hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors ml-2 ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        <Save size={16} />
                        <span>{isSaving ? 'Saving...' : 'Save & Export'}</span>
                    </button>
                </div>
            </div>

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-6 w-[400px]">
                        <h3 className="text-lg font-medium text-white mb-2">Document Security</h3>
                        <p className="text-sm text-white/60 mb-6">Set a password to encrypt this document on export. Only users with this password will be able to open it.</p>

                        <div className="mb-6">
                            <label className="block text-xs text-white/70 mb-2">Password</label>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="w-full bg-[#111] border border-white/10 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
                                placeholder="Enter password (optional)"
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setPasswordInput(state.document?.password || '');
                                    setShowPasswordModal(false);
                                }}
                                className="px-4 py-2 rounded-md hover:bg-white/5 text-sm font-medium transition-colors text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordSave}
                                className="px-4 py-2 bg-[#3b82f6] hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
