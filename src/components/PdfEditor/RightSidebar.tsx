import React from 'react';
import { PdfEditorState, Action } from './PdfEditorState';
import { X, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, Trash2, ImagePlus } from 'lucide-react';
import { fabricCanvasRegistry } from './pdfUtils';

// Fabric.js is loaded from CDN
declare var fabric: any;

interface RightSidebarProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ state, dispatch }) => {
    if (!state.propertiesPanelOpen) return null;

    const selectedType = state.selectedElementProps?.type;
    const isImage = selectedType === 'image';
    const isText = selectedType === 'i-text' || selectedType === 'text' || selectedType === 'textbox';
    const isShape = selectedType === 'rect' || selectedType === 'circle' || selectedType === 'path';

    // Helper: get active fabric canvas for selected element
    const getActiveCanvas = () => {
        for (const key of Object.keys(fabricCanvasRegistry)) {
            const fCanvas = fabricCanvasRegistry[Number(key)];
            const active = fCanvas?.getActiveObject?.();
            if (active && active.id === state.selectedElementId) {
                return { fCanvas, active };
            }
        }
        return null;
    };

    const handleFlipH = () => {
        const res = getActiveCanvas();
        if (!res) return;
        res.active.set({ flipX: !res.active.flipX });
        res.fCanvas.requestRenderAll();
    };

    const handleFlipV = () => {
        const res = getActiveCanvas();
        if (!res) return;
        res.active.set({ flipY: !res.active.flipY });
        res.fCanvas.requestRenderAll();
    };

    const handleRotateCW = () => {
        const res = getActiveCanvas();
        if (!res) return;
        res.active.rotate((res.active.angle || 0) + 15);
        res.fCanvas.requestRenderAll();
    };

    const handleRotateCCW = () => {
        const res = getActiveCanvas();
        if (!res) return;
        res.active.rotate((res.active.angle || 0) - 15);
        res.fCanvas.requestRenderAll();
    };

    const handleDelete = () => {
        const res = getActiveCanvas();
        if (!res) return;
        const obj = res.active;
        res.fCanvas.discardActiveObject();
        res.fCanvas.remove(obj);
        res.fCanvas.requestRenderAll();
        dispatch({ type: 'SET_SELECTED_ELEMENT', payload: { id: null } });
    };

    const handleReplaceImage = () => {
        const res = getActiveCanvas();
        if (!res) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (f) => {
                const dataUrl = f.target?.result as string;
                fabric.Image.fromURL(dataUrl, (newImg: any) => {
                    const oldObj = res.active;
                    // Match position and dimensions of old image
                    newImg.set({
                        left: oldObj.left,
                        top: oldObj.top,
                        scaleX: oldObj.scaleX,
                        scaleY: oldObj.scaleY,
                        angle: oldObj.angle || 0,
                        id: oldObj.id,
                        hasControls: true,
                        hasBorders: true,
                        cornerSize: 10,
                        cornerColor: '#3b82f6',
                        cornerStrokeColor: '#ffffff',
                        borderColor: '#3b82f6',
                        borderScaleFactor: 1.5,
                        transparentCorners: false,
                    });
                    res.fCanvas.remove(oldObj);
                    res.fCanvas.add(newImg);
                    res.fCanvas.setActiveObject(newImg);
                    res.fCanvas.requestRenderAll();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const inputClass = "w-full bg-[#252525] border border-white/10 rounded-lg px-3 py-2 text-sm text-white transition-all hover:border-white/20 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/40";
    const labelClass = "text-xs text-white/60 block mb-1.5 font-medium tracking-wide";
    const sectionClass = "space-y-3";
    const iconBtnClass = "flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/12 border border-white/10 hover:border-white/25 text-white/70 hover:text-white transition-all active:scale-95";

    return (
        <div className="w-72 bg-[#181818] border-l border-white/8 flex flex-col h-full hidden lg:flex shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <h3 className="text-sm font-semibold text-white tracking-wide">Properties</h3>
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_PROPERTIES_PANEL' })}
                    className="text-white/40 hover:text-white transition-colors rounded-md p-1 hover:bg-white/10"
                >
                    <X size={15} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {state.selectedElementId && state.selectedElementProps ? (
                    <div className="space-y-5">
                        {/* Element type badge */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-[#3b82f6]/20 text-[#3b82f6] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider">
                                {isImage ? 'Image' : isText ? 'Text' : isShape ? 'Shape' : selectedType}
                            </span>
                            <button
                                onClick={handleDelete}
                                title="Delete element"
                                className="ml-auto flex items-center gap-1.5 text-xs text-red-400/80 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
                            >
                                <Trash2 size={12} />
                                Delete
                            </button>
                        </div>

                        {/* ── IMAGE PROPERTIES ── */}
                        {isImage && (
                            <div className={sectionClass}>
                                <h4 className={labelClass + ' uppercase'}>Image Controls</h4>

                                {/* Flip & Rotate */}
                                <div>
                                    <label className={labelClass}>Transform</label>
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={handleFlipH} className={iconBtnClass} title="Flip Horizontal">
                                            <FlipHorizontal size={14} />
                                        </button>
                                        <button onClick={handleFlipV} className={iconBtnClass} title="Flip Vertical">
                                            <FlipVertical size={14} />
                                        </button>
                                        <button onClick={handleRotateCCW} className={iconBtnClass} title="Rotate -15°">
                                            <RotateCcw size={14} />
                                        </button>
                                        <button onClick={handleRotateCW} className={iconBtnClass} title="Rotate +15°">
                                            <RotateCw size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Opacity */}
                                <div>
                                    <label className={labelClass}>
                                        Opacity: {Math.round((state.selectedElementProps.opacity ?? 1) * 100)}%
                                    </label>
                                    <input
                                        type="range" min="0.05" max="1" step="0.05"
                                        value={state.selectedElementProps.opacity ?? 1}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { opacity: parseFloat(e.target.value) } })}
                                        className="w-full accent-[#3b82f6]"
                                    />
                                </div>

                                {/* Replace image */}
                                <button
                                    onClick={handleReplaceImage}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[#3b82f6]/15 hover:bg-[#3b82f6]/25 border border-[#3b82f6]/30 text-[#3b82f6] text-xs font-medium transition-all"
                                >
                                    <ImagePlus size={13} />
                                    Replace Image
                                </button>
                            </div>
                        )}

                        {/* ── TEXT PROPERTIES ── */}
                        {isText && (
                            <div className={sectionClass}>
                                <h4 className={labelClass + ' uppercase'}>Text Controls</h4>

                                <div>
                                    <label className={labelClass}>Text Color</label>
                                    <input
                                        type="color"
                                        value={state.selectedElementProps.fill || '#000000'}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fill: e.target.value } })}
                                        className="w-full h-9 rounded-lg cursor-pointer bg-transparent border border-white/10 px-1"
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Font Size</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number" min="6" max="120"
                                            value={state.selectedElementProps.fontSize || 14}
                                            onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fontSize: parseInt(e.target.value) } })}
                                            className={inputClass}
                                        />
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fontSize: (state.selectedElementProps?.fontSize || 14) + 2 } })}
                                                className={iconBtnClass + ' w-7 h-4 text-xs'}
                                            >+</button>
                                            <button
                                                onClick={() => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fontSize: Math.max(6, (state.selectedElementProps?.fontSize || 14) - 2) } })}
                                                className={iconBtnClass + ' w-7 h-4 text-xs'}
                                            >−</button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Font Family</label>
                                    <select
                                        value={state.selectedElementProps.fontFamily || 'sans-serif'}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fontFamily: e.target.value } })}
                                        className={inputClass + ' cursor-pointer'}
                                    >
                                        {['sans-serif', 'serif', 'monospace', 'Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana', 'Trebuchet MS'].map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>Opacity: {Math.round((state.selectedElementProps.opacity ?? 1) * 100)}%</label>
                                    <input
                                        type="range" min="0.05" max="1" step="0.05"
                                        value={state.selectedElementProps.opacity ?? 1}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { opacity: parseFloat(e.target.value) } })}
                                        className="w-full accent-[#3b82f6]"
                                    />
                                </div>

                                {selectedType === 'textbox' && (
                                    <div>
                                        <label className={labelClass}>Background Color</label>
                                        <input
                                            type="color"
                                            value={state.selectedElementProps.backgroundColor || '#fef9c3'}
                                            onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { backgroundColor: e.target.value } })}
                                            className="w-full h-9 rounded-lg cursor-pointer bg-transparent border border-white/10 px-1"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SHAPE PROPERTIES ── */}
                        {isShape && (
                            <div className={sectionClass}>
                                <h4 className={labelClass + ' uppercase'}>Shape Controls</h4>

                                <div>
                                    <label className={labelClass}>Fill Color</label>
                                    <input
                                        type="color"
                                        value={state.selectedElementProps.fill && state.selectedElementProps.fill !== 'transparent' ? state.selectedElementProps.fill : '#ffffff'}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { fill: e.target.value } })}
                                        className="w-full h-9 rounded-lg cursor-pointer bg-transparent border border-white/10 px-1"
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Stroke Color</label>
                                    <input
                                        type="color"
                                        value={state.selectedElementProps.stroke || '#000000'}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { stroke: e.target.value } })}
                                        className="w-full h-9 rounded-lg cursor-pointer bg-transparent border border-white/10 px-1"
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Stroke Width: {state.selectedElementProps.strokeWidth ?? 1}px</label>
                                    <input
                                        type="range" min="0" max="20"
                                        value={state.selectedElementProps.strokeWidth ?? 1}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { strokeWidth: parseInt(e.target.value) } })}
                                        className="w-full accent-[#3b82f6]"
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Opacity: {Math.round((state.selectedElementProps.opacity ?? 1) * 100)}%</label>
                                    <input
                                        type="range" min="0.05" max="1" step="0.05"
                                        value={state.selectedElementProps.opacity ?? 1}
                                        onChange={(e) => dispatch({ type: 'UPDATE_ELEMENT_PROPS', payload: { opacity: parseFloat(e.target.value) } })}
                                        className="w-full accent-[#3b82f6]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* No selection – show document info */
                    <div className="space-y-5">
                        <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Document Info</h4>
                        <div className="space-y-3">
                            <div>
                                <label className={labelClass}>File Name</label>
                                <input
                                    type="text"
                                    value={state.document?.fileName || '—'}
                                    className={inputClass + ' cursor-default'}
                                    readOnly
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Pages</label>
                                    <div className="text-white text-sm font-medium">{state.document?.numPages || 0}</div>
                                </div>
                                <div>
                                    <label className={labelClass}>Size</label>
                                    <div className="text-white text-sm font-medium">
                                        {state.document?.fileSize ? `${(state.document.fileSize / 1024 / 1024).toFixed(2)} MB` : '—'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg bg-white/4 border border-white/8 p-3">
                            <p className="text-xs text-white/40 leading-relaxed">
                                💡 Click any text, image, or shape in the document to see its properties and controls here.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Editing Tips</h4>
                            <div className="space-y-1.5">
                                {[
                                    ['🖱', 'Click to select & move'],
                                    ['↔', 'Drag corners to resize'],
                                    ['⌫', 'Delete key to remove'],
                                    ['↩', 'Double-click text to edit'],
                                    ['⌨', 'Arrow keys to nudge'],
                                ].map(([icon, text]) => (
                                    <div key={text} className="flex items-start gap-2 text-xs text-white/40">
                                        <span className="text-white/60 shrink-0">{icon}</span>
                                        <span>{text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
