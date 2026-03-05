import React from 'react';
import { PdfEditorState, Action } from './PdfEditorState';
import { X } from 'lucide-react';

interface RightSidebarProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ state, dispatch }) => {
    if (!state.propertiesPanelOpen) return null;

    return (
        <div className="w-72 bg-[#1a1a1a] border-l border-white/10 flex flex-col h-full hidden lg:flex shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Properties</h3>
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_PROPERTIES_PANEL' })}
                    className="text-white/50 hover:text-white"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {state.selectedElementId && state.selectedElementProps ? (
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                            {state.selectedElementProps.type} PROPERTIES
                        </h4>

                        {(state.selectedElementProps.type === 'rect' || state.selectedElementProps.type === 'circle' || state.selectedElementProps.type === 'path') && (
                            <>
                                <div className="group">
                                    <label className="text-xs text-white/70 block mb-2 transition-colors group-hover:text-white">Stroke Color</label>
                                    <input
                                        type="color"
                                        value={state.selectedElementProps.stroke || '#000000'}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { stroke: e.target.value } })}
                                        className="w-full h-8 rounded cursor-pointer bg-transparent border-none transition-transform hover:scale-[1.02]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/70 block mb-2 transition-colors hover:text-white">Stroke Width: {state.selectedElementProps.strokeWidth || 1}</label>
                                    <input
                                        type="range" min="1" max="20"
                                        value={state.selectedElementProps.strokeWidth || 1}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { strokeWidth: parseInt(e.target.value) } })}
                                        className="w-full accent-[#3b82f6] hover:accent-blue-400 transition-all"
                                    />
                                </div>
                            </>
                        )}

                        {(state.selectedElementProps.type === 'i-text' || state.selectedElementProps.type === 'text' || state.selectedElementProps.type === 'textbox') && (
                            <>
                                <div className="group">
                                    <label className="text-xs text-white/70 block mb-2 transition-colors group-hover:text-white">Text Color</label>
                                    <input
                                        type="color"
                                        value={state.selectedElementProps.fill || '#000000'}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fill: e.target.value } })}
                                        className="w-full h-8 rounded cursor-pointer bg-transparent border-none transition-transform hover:scale-[1.02]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/70 block mb-2 transition-colors group-hover:text-white">Font Size</label>
                                    <input
                                        type="number"
                                        value={state.selectedElementProps.fontSize || 24}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fontSize: parseInt(e.target.value) } })}
                                        className="w-full bg-[#2a2a2a] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white transition-all hover:border-white/30 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/50"
                                    />
                                </div>
                                {state.selectedElementProps.type === 'textbox' && (
                                    <div className="group">
                                        <label className="text-xs text-white/70 block mb-2 transition-colors group-hover:text-white">Background Color</label>
                                        <input
                                            type="color"
                                            value={state.selectedElementProps.backgroundColor || '#fcf6bd'}
                                            onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { backgroundColor: e.target.value } })}
                                            className="w-full h-8 rounded cursor-pointer bg-transparent border-none transition-transform hover:scale-[1.02]"
                                        />
                                    </div>
                                )}
                            </>
                        )}

                    </div>
                ) : (
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Document Settings</h4>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-white/70 block mb-1">File Name</label>
                                <input
                                    type="text"
                                    value={state.document?.fileName || 'Document 1.pdf'}
                                    className="w-full bg-[#2a2a2a] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                                    readOnly
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <label className="text-xs text-white/70 block mb-1">Pages</label>
                                    <div className="text-white">{state.document?.numPages || 0}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-white/70 block mb-1">Size</label>
                                    <div className="text-white">{state.document?.fileSize ? `${(state.document.fileSize / 1024 / 1024).toFixed(2)} MB` : '--'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
