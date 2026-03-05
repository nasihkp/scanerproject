import React, { useEffect, useRef } from 'react';
import { Action, ToolName } from './PdfEditorState';
import { fabricCanvasRegistry } from './pdfUtils';

// We put fabric in an ambient declaration since it's from CDN
declare var fabric: any;

interface PdfPageRendererProps {
    pdfDoc: any; // Using any for pdfjsLib document
    pageNum: number;
    scale: number;
    activeTool: ToolName;
    dispatch: React.Dispatch<Action>;
    selectedElementProps?: any;
    selectedElementId?: string | null;
    history: any[];
    historyIndex: number;
}

export const PdfPageRenderer: React.FC<PdfPageRendererProps> = ({
    pdfDoc,
    pageNum,
    scale,
    activeTool,
    dispatch,
    selectedElementProps,
    selectedElementId,
    history,
    historyIndex
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasElementRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<any>(null);
    const isHistoryOperation = useRef<boolean>(false);
    const pristineStateJSON = useRef<any>(null);

    useEffect(() => {
        let renderTask: any = null;

        const initPage = async () => {
            if (!pdfDoc || !canvasElementRef.current || !containerRef.current) return;

            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            // Render PDF to offscreen canvas
            const offscreenCanvas = document.createElement('canvas');
            const context = offscreenCanvas.getContext('2d');
            if (!context) return;

            offscreenCanvas.height = viewport.height;
            offscreenCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            try {
                renderTask = page.render(renderContext);
                await renderTask.promise;

                // Initialize Fabric canvas
                if (!fabricCanvasRef.current) {
                    const fabricCanvas = new fabric.Canvas(canvasElementRef.current, {
                        width: viewport.width,
                        height: viewport.height,
                        selection: true,
                    });
                    fabricCanvasRef.current = fabricCanvas;

                    // Register canvas to global registry
                    fabricCanvasRegistry[pageNum] = fabricCanvas;

                    // Set background
                    const bgImage = new fabric.Image(offscreenCanvas);
                    fabricCanvas.setBackgroundImage(bgImage, () => {
                        fabricCanvas.renderAll();
                        // Record the base empty state for undo-to-start
                        pristineStateJSON.current = fabricCanvas.toJSON(['id', 'isPdfForm', 'formType', 'isRedaction']);
                    });

                    // Selection event
                    fabricCanvas.on('selection:created', (e: any) => {
                        if (e.selected && e.selected.length === 1) {
                            const obj = e.selected[0];
                            if (!obj.id) obj.id = Math.random().toString(36).substr(2, 9);
                            dispatch({
                                type: 'SET_SELECTED_ELEMENT',
                                payload: {
                                    id: obj.id,
                                    props: {
                                        type: obj.type,
                                        fill: obj.fill,
                                        stroke: obj.stroke,
                                        strokeWidth: obj.strokeWidth,
                                        fontSize: obj.fontSize,
                                        fontFamily: obj.fontFamily,
                                        text: obj.text,
                                        opacity: obj.opacity,
                                        backgroundColor: obj.backgroundColor
                                    }
                                }
                            });
                        } else {
                            dispatch({ type: 'SET_SELECTED_ELEMENT', payload: { id: null } });
                        }
                    });
                    fabricCanvas.on('selection:cleared', () => {
                        dispatch({ type: 'SET_SELECTED_ELEMENT', payload: { id: null } });
                    });
                } else {
                    // If already exists, just update dimensions and background
                    const fCanvas = fabricCanvasRef.current;
                    fCanvas.setWidth(viewport.width);
                    fCanvas.setHeight(viewport.height);

                    const bgImage = new fabric.Image(offscreenCanvas);
                    fCanvas.setBackgroundImage(bgImage, fCanvas.renderAll.bind(fCanvas));
                }

            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNum}:`, err);
                }
            }
        };

        initPage();

        return () => {
            if (renderTask) {
                renderTask.cancel();
            }
            if (fabricCanvasRegistry[pageNum]) {
                delete fabricCanvasRegistry[pageNum];
            }
        };
    }, [pdfDoc, pageNum, scale, dispatch]);

    // Track Canvas Changes for History & Snap to Grid
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;

        const GRID_SIZE = 20;

        const handleMoving = (opt: any) => {
            // Snap to Grid functionality
            if (opt.target) {
                opt.target.set({
                    left: Math.round(opt.target.left / GRID_SIZE) * GRID_SIZE,
                    top: Math.round(opt.target.top / GRID_SIZE) * GRID_SIZE
                });
            }
        };

        const handleCanvasChange = (opt: any) => {
            if (isHistoryOperation.current) return;

            // Ensure any new object has an ID before saving history
            if (opt && opt.target && !opt.target.id) {
                opt.target.set({ id: Math.random().toString(36).substr(2, 9) });
            }

            // Debounce or dispatch immediately
            const json = fCanvas.toJSON(['id', 'isPdfForm', 'formType', 'isRedaction']);
            dispatch({
                type: 'SAVE_HISTORY',
                payload: { pageNum, json }
            });
        };

        // We use mouse:up instead of object:added/modified directly to prevent 
        // intermediate states (like drawing paths) from spamming history.
        // Actually object:modified fires on mouse up after transform, but 
        // path:created is specific to drawing. Let's use standard events safely.
        fCanvas.on('object:modified', handleCanvasChange);
        fCanvas.on('object:added', handleCanvasChange);
        fCanvas.on('object:removed', handleCanvasChange);
        fCanvas.on('object:moving', handleMoving);

        return () => {
            fCanvas.off('object:modified', handleCanvasChange);
            fCanvas.off('object:added', handleCanvasChange);
            fCanvas.off('object:removed', handleCanvasChange);
            fCanvas.off('object:moving', handleMoving);
        };
    }, [dispatch, pageNum]);

    // Handle History Index Reversions (Undo/Redo)
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;

        // Find the state for THIS page at or before the given historyIndex
        let targetState = null;
        for (let i = historyIndex; i >= 0; i--) {
            if (history[i] && history[i].pageNum === pageNum) {
                targetState = history[i].json;
                break;
            }
        }

        isHistoryOperation.current = true;

        const finishLoad = () => {
            fCanvas.requestRenderAll();
            // allow next cycle to reset history flag so event listeners don't catch it
            setTimeout(() => { isHistoryOperation.current = false; }, 0);
        };

        if (targetState) {
            fCanvas.loadFromJSON(targetState, finishLoad);
        } else if (pristineStateJSON.current) {
            fCanvas.loadFromJSON(pristineStateJSON.current, finishLoad);
        } else {
            isHistoryOperation.current = false;
        }

    }, [historyIndex, history, pageNum]);

    // Handle Tool Changes
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;

        // Reset modes
        fCanvas.isDrawingMode = false;
        fCanvas.selection = true;
        fCanvas.defaultCursor = 'default';
        fCanvas.forEachObject((obj: any) => {
            obj.selectable = true;
            obj.evented = true;
        });

        switch (activeTool) {
            case 'pen':
                fCanvas.isDrawingMode = true;
                fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
                fCanvas.freeDrawingBrush.color = '#ff0000';
                fCanvas.freeDrawingBrush.width = 3;
                break;
            case 'highlighter':
                fCanvas.isDrawingMode = true;
                fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
                fCanvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.4)';
                fCanvas.freeDrawingBrush.width = 15;
                break;
            case 'eraser':
                fCanvas.selection = false;
                fCanvas.defaultCursor = 'crosshair';
                fCanvas.forEachObject((obj: any) => {
                    obj.selectable = true;
                });
                break;
            case 'add_text':
            case 'rectangle':
            case 'circle':
            case 'image':
            case 'signature':
            case 'sticky_note':
            case 'form_text':
            case 'form_checkbox':
            case 'form_radio':
            case 'redact':
                fCanvas.selection = false;
                fCanvas.defaultCursor = 'crosshair';
                fCanvas.forEachObject((obj: any) => {
                    obj.selectable = false;
                });
                break;
            case 'pan':
                fCanvas.selection = false;
                fCanvas.defaultCursor = 'grab';
                fCanvas.forEachObject((obj: any) => {
                    obj.selectable = false;
                    obj.evented = false;
                });
                break;
            default:
                break;
        }
    }, [activeTool]);

    // Handle clicks and drags based on tools
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;

        let isEraserDrawing = false;

        const handleMouseDown = (opt: any) => {
            if (activeTool === 'add_text' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const iText = new fabric.IText('Text', {
                    left: pointer.x,
                    top: pointer.y,
                    fontFamily: 'sans-serif',
                    fill: '#000000',
                    fontSize: 24,
                    id: Math.random().toString(36).substr(2, 9),
                });
                fCanvas.add(iText);
                fCanvas.setActiveObject(iText);
                iText.enterEditing();
                iText.selectAll();
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' }); // Revert after placement
            } else if (activeTool === 'rectangle' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const rect = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    fill: 'transparent',
                    stroke: '#ff0000',
                    strokeWidth: 2,
                    width: 100,
                    height: 60,
                    id: Math.random().toString(36).substr(2, 9),
                });
                fCanvas.add(rect);
                fCanvas.setActiveObject(rect);
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
            } else if (activeTool === 'circle' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const circle = new fabric.Circle({
                    left: pointer.x,
                    top: pointer.y,
                    fill: 'transparent',
                    stroke: '#0000ff',
                    strokeWidth: 2,
                    radius: 40,
                    id: Math.random().toString(36).substr(2, 9),
                });
                fCanvas.add(circle);
                fCanvas.setActiveObject(circle);
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
            } else if ((activeTool === 'image' || activeTool === 'signature') && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (f) => {
                        const dataUrl = f.target?.result as string;
                        fabric.Image.fromURL(dataUrl, (img: any) => {
                            img.set({
                                left: pointer.x,
                                top: pointer.y,
                                id: Math.random().toString(36).substr(2, 9),
                            });
                            img.scaleToWidth(activeTool === 'signature' ? 150 : 250);
                            fCanvas.add(img);
                            fCanvas.setActiveObject(img);
                            dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
                        });
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            } else if (activeTool === 'sticky_note' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const stickyNote = new fabric.Textbox('Add note...', {
                    left: pointer.x,
                    top: pointer.y,
                    width: 150,
                    fontSize: 16,
                    fontFamily: 'sans-serif',
                    fill: '#000000',
                    backgroundColor: '#fcf6bd',
                    padding: 10,
                    borderColor: '#d4af37',
                    cornerColor: '#d4af37',
                    cornerSize: 8,
                    transparentCorners: false,
                    id: Math.random().toString(36).substr(2, 9),
                });
                fCanvas.add(stickyNote);
                fCanvas.setActiveObject(stickyNote);
                stickyNote.enterEditing();
                stickyNote.selectAll();
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
            } else if (activeTool === 'form_text' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const rect = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    fill: 'rgba(173, 216, 230, 0.4)',
                    stroke: '#3b82f6',
                    strokeWidth: 1,
                    width: 150,
                    height: 30,
                    id: Math.random().toString(36).substr(2, 9),
                });
                // Custom properties to identify during export
                rect.set('isPdfForm', true);
                rect.set('formType', 'text');
                fCanvas.add(rect);
                fCanvas.setActiveObject(rect);
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
            } else if (activeTool === 'form_checkbox' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const rect = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    fill: 'rgba(173, 216, 230, 0.4)',
                    stroke: '#3b82f6',
                    strokeWidth: 1,
                    width: 20,
                    height: 20,
                    id: Math.random().toString(36).substr(2, 9),
                });
                rect.set('isPdfForm', true);
                rect.set('formType', 'checkbox');
                fCanvas.add(rect);
                fCanvas.setActiveObject(rect);
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
            } else if (activeTool === 'form_radio' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const circle = new fabric.Circle({
                    left: pointer.x,
                    top: pointer.y,
                    fill: 'rgba(173, 216, 230, 0.4)',
                    stroke: '#3b82f6',
                    strokeWidth: 1,
                    radius: 10,
                    id: Math.random().toString(36).substr(2, 9),
                });
                circle.set('isPdfForm', true);
                circle.set('formType', 'radio');
                fCanvas.add(circle);
                fCanvas.setActiveObject(circle);
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
            } else if (activeTool === 'redact' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const rect = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    fill: '#000000',
                    width: 100,
                    height: 20,
                    id: Math.random().toString(36).substr(2, 9),
                });
                rect.set('isRedaction', true);
                fCanvas.add(rect);
                fCanvas.setActiveObject(rect);
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
            } else if (activeTool === 'eraser') {
                if (opt.target && opt.target.type !== 'image' && !opt.target.isPdfForm) {
                    // Clicked on a drawn object or text
                    fCanvas.remove(opt.target);
                    // The object:removed listener will catch this and save history
                } else {
                    // Start pointwise drawing "magic erase"
                    fCanvas.isDrawingMode = true;
                    fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
                    fCanvas.freeDrawingBrush.color = '#ffffff';
                    fCanvas.freeDrawingBrush.width = 25; // Good size for eraser

                    // Manually trigger the brush's mousedown so it starts drawing right away
                    const pointer = fCanvas.getPointer(opt.e);
                    fCanvas.freeDrawingBrush.onMouseDown(pointer, { e: opt.e });
                    isEraserDrawing = true;
                }
            }
        };

        const handleMouseMove = (opt: any) => {
            // Native fabric handles mouse move for free drawing mode automatically.
        };

        const handleMouseUp = (opt: any) => {
            if (activeTool === 'eraser' && isEraserDrawing) {
                isEraserDrawing = false;
                fCanvas.isDrawingMode = false;
            }
        };

        fCanvas.on('mouse:down', handleMouseDown);
        fCanvas.on('mouse:move', handleMouseMove);
        fCanvas.on('mouse:up', handleMouseUp);

        return () => {
            fCanvas.off('mouse:down', handleMouseDown);
            fCanvas.off('mouse:move', handleMouseMove);
            fCanvas.off('mouse:up', handleMouseUp);
        };
    }, [activeTool, dispatch]);

    // Listen for global property changes
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas || !selectedElementId || !selectedElementProps) return;

        const activeObj = fCanvas.getActiveObject();
        if (activeObj && activeObj.id === selectedElementId) {
            let changed = false;
            ['fill', 'stroke', 'strokeWidth', 'fontSize', 'fontFamily', 'text', 'opacity'].forEach(key => {
                if (selectedElementProps[key] !== undefined && activeObj[key] !== selectedElementProps[key]) {
                    activeObj.set(key, selectedElementProps[key]);
                    changed = true;
                }
            });
            if (changed) {
                fCanvas.requestRenderAll();
            }
        }
    }, [selectedElementProps, selectedElementId]);

    return (
        <div
            ref={containerRef}
            className="relative bg-white shadow-md mx-auto mb-8"
            style={{ minHeight: `${800 * scale}px`, minWidth: `${600 * scale}px` }}
        >
            <canvas ref={canvasElementRef} className="block shadow-lg m-auto" />
        </div>
    );
};
