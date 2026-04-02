import React, { useEffect, useRef } from 'react';
import { Action, ToolName } from './PdfEditorState';
import { fabricCanvasRegistry } from './pdfUtils';

// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// We put fabric in an ambient declaration since it's from CDN
declare var fabric: any;

// ── PDF Object Decomposition Helpers ──

function multiplyMatrices(m1: number[], m2: number[]): number[] {
    return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];
}

interface ExtractedImage {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    dataUrl: string;
}

async function extractPageImages(page: any, viewport: any): Promise<ExtractedImage[]> {
    const results: ExtractedImage[] = [];
    try {
        const ops = await page.getOperatorList();
        const OPS = pdfjsLib.OPS;
        const ctmStack: number[][] = [];
        let ctm: number[] = [1, 0, 0, 1, 0, 0];

        for (let i = 0; i < ops.fnArray.length; i++) {
            const fn = ops.fnArray[i];
            const args = ops.argsArray[i];

            if (fn === OPS.save) {
                ctmStack.push([...ctm]);
            } else if (fn === OPS.restore) {
                ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
            } else if (fn === OPS.transform) {
                ctm = multiplyMatrices(ctm, args as number[]);
            } else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
                const imgName = args[0] as string;
                try {
                    const imgObj: any = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('timeout')), 3000);
                        page.objs.get(imgName, (data: any) => {
                            clearTimeout(timeout);
                            resolve(data);
                        });
                    });
                    if (!imgObj || !imgObj.width || !imgObj.height) continue;

                    const vt = viewport.transform;
                    const fullCtm = multiplyMatrices(vt, ctm);
                    const canvasWidth = Math.abs(Math.hypot(fullCtm[0], fullCtm[1]));
                    const canvasHeight = Math.abs(Math.hypot(fullCtm[2], fullCtm[3]));
                    const canvasX = fullCtm[4];
                    const canvasY = fullCtm[5] - canvasHeight;

                    // Skip tiny images and full-page backgrounds
                    const pageArea = viewport.width * viewport.height;
                    if (canvasWidth < 20 || canvasHeight < 20) continue;
                    if (canvasWidth * canvasHeight > pageArea * 0.9) continue;

                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = imgObj.width;
                    offCanvas.height = imgObj.height;
                    const offCtx = offCanvas.getContext('2d');
                    if (!offCtx) continue;

                    const imageData = offCtx.createImageData(imgObj.width, imgObj.height);
                    if (imgObj.data) {
                        const src = imgObj.data;
                        const dst = imageData.data;
                        const totalPx = imgObj.width * imgObj.height;
                        if (src.length === totalPx * 4) {
                            dst.set(src);
                        } else if (src.length === totalPx * 3) {
                            for (let p = 0; p < totalPx; p++) {
                                dst[p * 4] = src[p * 3];
                                dst[p * 4 + 1] = src[p * 3 + 1];
                                dst[p * 4 + 2] = src[p * 3 + 2];
                                dst[p * 4 + 3] = 255;
                            }
                        }
                        offCtx.putImageData(imageData, 0, 0);
                    } else if (imgObj instanceof HTMLImageElement || imgObj instanceof HTMLCanvasElement) {
                        offCtx.drawImage(imgObj, 0, 0);
                    } else {
                        continue;
                    }

                    results.push({
                        name: imgName,
                        x: canvasX,
                        y: canvasY,
                        width: canvasWidth,
                        height: canvasHeight,
                        dataUrl: offCanvas.toDataURL('image/png'),
                    });
                } catch (e) {
                    console.warn(`Failed to extract image ${imgName}:`, e);
                }
            }
        }
    } catch (err) {
        console.warn('Image extraction from page failed:', err);
    }
    return results;
}

// Custom serialization properties for all toJSON calls
const CUSTOM_PROPS = [
    'id', 'isPdfForm', 'formType', 'isRedaction',
    'isOriginalText', 'isOriginalTextCover', 'originalStr', 'isEdited',
    'isOriginalImage', 'isOriginalImageCover',
    'originalLeft', 'originalTop', 'originalWidth', 'originalHeight'
];


interface PdfPageRendererProps {
    pdfDoc: any; // Using any for pdfjsLib document
    bgPdfDoc?: any; // Textless pdfjsLib document
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
    bgPdfDoc,
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
    
    // Use refs for offscreen canvases so that the fabric event listeners (which are set once)
    // always point to the most recent rendered content.
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const offscreenTextlessCanvasRef = useRef<HTMLCanvasElement | null>(null);
    
    const isHistoryOperation = useRef<boolean>(false);
    const pristineStateJSON = useRef<any>(null);

    useEffect(() => {
        let renderTask: any = null;

        const initPage = async () => {
            if (!pdfDoc || !canvasElementRef.current || !containerRef.current) return;

            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            // Initialize offscreen canvases if they don't exist
            if (!offscreenCanvasRef.current) {
                offscreenCanvasRef.current = document.createElement('canvas');
            }
            if (!offscreenTextlessCanvasRef.current) {
                offscreenTextlessCanvasRef.current = document.createElement('canvas');
            }
            
            const offscreenCanvas = offscreenCanvasRef.current;
            const offscreenTextlessCanvas = offscreenTextlessCanvasRef.current;
            
            const context = offscreenCanvas.getContext('2d');
            const contextTextless = offscreenTextlessCanvas.getContext('2d');
            
            if (!context || !contextTextless) return;

            offscreenCanvas.height = viewport.height;
            offscreenCanvas.width = viewport.width;
            offscreenTextlessCanvas.height = viewport.height;
            offscreenTextlessCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            
            const renderContextTextless = {
                canvasContext: contextTextless,
                viewport: viewport,
            };

            try {
                // Render both concurrently
                renderTask = page.render(renderContext);
                const bgPageRenderTask = bgPdfDoc ? bgPdfDoc.getPage(pageNum).then((bgPage: any) => bgPage.render(renderContextTextless).promise) : Promise.resolve();
                
                await Promise.all([renderTask.promise, bgPageRenderTask]);

                // Initialize Fabric canvas
                if (!fabricCanvasRef.current) {
                    const fabricCanvas = new fabric.Canvas(canvasElementRef.current, {
                        width: viewport.width,
                        height: viewport.height,
                        selection: true,
                        backgroundColor: '#ffffff',
                    });
                    fabricCanvasRef.current = fabricCanvas;

                    // Register canvas to global registry
                    fabricCanvasRegistry[pageNum] = fabricCanvas;

                    // Set rendered PDF page as the fabric canvas background image
                    const bgImage = new fabric.Image(offscreenCanvas);
                    fabricCanvas.setBackgroundImage(bgImage, async () => {
                        fabricCanvas.renderAll();

                        // ── Extract PDF text objects and create selectable overlays ──
                        try {
                            const textContent = await page.getTextContent();
                            (textContent.items as any[]).forEach((item: any) => {
                                if (!item.str || !item.str.trim()) return;

                                // Convert PDF coords (bottom-left origin) to canvas coords (top-left origin)
                                const [cx, cy] = viewport.convertToViewportPoint(
                                    item.transform[4],
                                    item.transform[5]
                                );

                                // Font height: use item.height (PDF units) × scale, fallback to transform scaleY
                                const fontH = Math.max(
                                    (item.height ? item.height : Math.abs(item.transform[3])) * scale,
                                    6
                                );

                                // cy is the baseline; top of glyph box is cy - fontH
                                const textTop = cy - fontH;

                                const overlayId = `txt_${Math.random().toString(36).substr(2, 9)}`;
                                const textOverlay = new fabric.IText(item.str, {
                                    left: cx,
                                    top: textTop,
                                    fontSize: fontH * 1.1,
                                    fontFamily: 'sans-serif',
                                    fill: 'rgba(0,0,0,0)', // Invisible initially so original PDF text shows through
                                    backgroundColor: 'rgba(59,130,246,0)',
                                    selectable: true,
                                    evented: true,
                                    id: overlayId,
                                    transparentCorners: false,
                                    cornerSize: 5,
                                    borderColor: '#3b82f6',
                                    cornerColor: '#3b82f6',
                                    cornerStrokeColor: '#3b82f6',
                                    cursorColor: '#000000',
                                    hoverCursor: 'pointer',
                                });
                                // Custom PDF metadata (preserved in toJSON serialization)
                                (textOverlay as any).isOriginalText = true;
                                (textOverlay as any).originalStr = item.str;
                                fabricCanvas.add(textOverlay);
                            });
                            fabricCanvas.renderAll();
                        } catch (textErr) {
                            console.warn('Text extraction failed:', textErr);
                        }

                        // ── Extract embedded images as independent movable objects ──
                        try {
                            const extractedImages = await extractPageImages(page, viewport);
                            const imageLoadPromises = extractedImages.map((img) => {
                                return new Promise<void>((resolve) => {
                                    fabric.Image.fromURL(img.dataUrl, (fabricImg: any) => {
                                        if (!fabricImg) { resolve(); return; }
                                        fabricImg.set({
                                            left: img.x,
                                            top: img.y,
                                            scaleX: img.width / (fabricImg.width || 1),
                                            scaleY: img.height / (fabricImg.height || 1),
                                            id: `img_${Math.random().toString(36).substr(2, 9)}`,
                                            selectable: true,
                                            evented: true,
                                            transparentCorners: false,
                                            cornerSize: 6,
                                            borderColor: '#10b981',
                                            cornerColor: '#10b981',
                                            cornerStrokeColor: '#10b981',
                                            hoverCursor: 'move',
                                        });
                                        (fabricImg as any).isOriginalImage = true;
                                        (fabricImg as any).originalLeft = img.x;
                                        (fabricImg as any).originalTop = img.y;
                                        (fabricImg as any).originalWidth = img.width;
                                        (fabricImg as any).originalHeight = img.height;
                                        fabricCanvas.add(fabricImg);
                                        resolve();
                                    });
                                });
                            });
                            await Promise.all(imageLoadPromises);
                            if (extractedImages.length > 0) {
                                console.log(`Decomposed ${extractedImages.length} image(s) from page ${pageNum}`);
                                fabricCanvas.renderAll();
                            }
                        } catch (imgErr) {
                            console.warn('Image decomposition failed:', imgErr);
                        }

                        // Capture pristine state AFTER text + image overlays are added
                        pristineStateJSON.current = fabricCanvas.toJSON(CUSTOM_PROPS);
                    });

                    // ── Hover highlights on PDF text and image objects ──
                    fabricCanvas.on('mouse:over', (e: any) => {
                        if (e.target && (e.target as any).isOriginalText) {
                            if (!(e.target as any).isEdited) {
                                e.target.set({ backgroundColor: 'rgba(59,130,246,0.12)' });
                                fabricCanvas.renderAll();
                            }
                        } else if (e.target && (e.target as any).isOriginalImage) {
                            e.target.set({ borderColor: '#10b981', shadow: new fabric.Shadow({ color: 'rgba(16,185,129,0.3)', blur: 8 }) });
                            fabricCanvas.renderAll();
                        }
                    });
                    fabricCanvas.on('mouse:out', (e: any) => {
                        const obj = e.target;
                        if (obj && (obj as any).isOriginalText) {
                            const isSelected = fabricCanvas.getActiveObjects().includes(obj);
                            if (!isSelected && !(obj as any).isEdited) {
                                obj.set({ backgroundColor: 'rgba(0,0,0,0)' });
                                fabricCanvas.renderAll();
                            }
                        } else if (obj && (obj as any).isOriginalImage) {
                            const isSelected = fabricCanvas.getActiveObjects().includes(obj);
                            if (!isSelected) {
                                obj.set({ shadow: null });
                                fabricCanvas.renderAll();
                            }
                        }
                    });

                    // Selection event
                    fabricCanvas.on('selection:created', (e: any) => {
                        if (e.selected && e.selected.length === 1) {
                            const obj = e.selected[0];
                            if (!obj.id) obj.id = Math.random().toString(36).substr(2, 9);
                            // Show selection highlight on PDF text objects
                            if ((obj as any).isOriginalText && !(obj as any).isEdited) {
                                obj.set({ backgroundColor: 'rgba(59,130,246,0.2)' });
                                fabricCanvas.renderAll();
                            }
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
                    fabricCanvas.on('selection:updated', (e: any) => {
                        // Deselected objects: reset highlight
                        (e.deselected || []).forEach((obj: any) => {
                            if (obj.isOriginalText && !obj.isEdited) {
                                obj.set({ backgroundColor: 'rgba(0,0,0,0)' });
                            }
                        });
                        fabricCanvas.renderAll();
                    });
                    fabricCanvas.on('selection:cleared', (e: any) => {
                        // Reset highlight on all deselected text objects
                        (e.deselected || []).forEach((obj: any) => {
                            if (obj.isOriginalText && !obj.isEdited) {
                                obj.set({ backgroundColor: 'rgba(0,0,0,0)' });
                            }
                        });
                        fabricCanvas.renderAll();
                        dispatch({ type: 'SET_SELECTED_ELEMENT', payload: { id: null } });
                    });

                    // ── Inline Editing Entry ──
                    fabricCanvas.on('text:editing:entered', (e: any) => {
                        const obj = e.target;
                        if (obj && obj.isOriginalText && !obj.isEdited) {
                            
                            // Bounds of the text object
                            const left = obj.left;
                            const top = obj.top;
                            const width = obj.width * (obj.scaleX || 1);
                            const height = obj.height * (obj.scaleY || 1);
                            
                            // Draw the exact region from the textless canvas to a temporary patch canvas
                            const patchCanvas = document.createElement('canvas');
                            patchCanvas.width = width;
                            patchCanvas.height = height;
                            const patchCtx = patchCanvas.getContext('2d');
                            if (patchCtx && offscreenTextlessCanvasRef.current) {
                                // If background is still loading (bgPdfDoc === pdfDoc), use solid white fallback 
                                // to prevent overlapping text mess.
                                if (bgPdfDoc && pdfDoc && bgPdfDoc === pdfDoc) {
                                    patchCtx.fillStyle = '#ffffff';
                                    patchCtx.fillRect(0, 0, width, height);
                                } else {
                                    patchCtx.drawImage(
                                        offscreenTextlessCanvasRef.current, 
                                        left, top, width, height, // Source rect
                                        0, 0, width, height       // Dest rect
                                    );
                                }
                            }
                            
                            // Spawn the invisible cloaking patch underneath to hide original PDF text natively
                            const cover = new fabric.Image(patchCanvas, {
                                left: left,
                                top: top,
                                width: width,
                                height: height,
                                selectable: false,
                                evented: false,
                                id: `cover_${Math.random().toString(36).substr(2, 9)}`,
                            });
                            (cover as any).isOriginalTextCover = true;
                            
                            // Send cover to back, but make sure canvas background stays absolute back
                            fabricCanvas.add(cover);
                            cover.sendToBack();

                            // Make text visible and clear background hover highlight
                            obj.set({ 
                                fill: '#000000', 
                                backgroundColor: 'rgba(0,0,0,0)',
                                isEdited: true 
                            });
                            
                            fabricCanvas.renderAll();

                            // Trigger history save
                            const json = fabricCanvas.toJSON(['id', 'isPdfForm', 'formType', 'isRedaction', 'isOriginalText', 'isOriginalTextCover', 'originalStr', 'isEdited']);
                            dispatch({ type: 'SAVE_HISTORY', payload: { pageNum, json } });
                        }
                    });
                } else {
                    // Update dimensions and background if already initialized
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
    }, [pdfDoc, bgPdfDoc, pageNum, scale, dispatch]);

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
            const json = fCanvas.toJSON(['id', 'isPdfForm', 'formType', 'isRedaction', 'isOriginalText', 'isOriginalTextCover', 'originalStr', 'isEdited']);
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
                fCanvas.isDrawingMode = true;
                fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
                fCanvas.freeDrawingBrush.color = '#ffffff';
                fCanvas.freeDrawingBrush.width = 20;
                fCanvas.selection = true;
                fCanvas.defaultCursor = 'crosshair';
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
            default:
                break;
        }
    }, [activeTool]);

    // Handle Keyboard Shortcuts (Delete/Backspace)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const fCanvas = fabricCanvasRef.current;
            if (!fCanvas) return;

            // Only proceed if not editing an IText/Textbox
            const activeObject = fCanvas.getActiveObject();
            if (activeObject && activeObject.isEditing) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const selectedObjects = fCanvas.getActiveObjects();
                if (selectedObjects.length > 0) {
                    fCanvas.discardActiveObject();
                    selectedObjects.forEach((obj: any) => {
                        if (obj.isOriginalText) {
                            const cover = new fabric.Rect({
                                left: obj.left,
                                top: obj.top,
                                width: obj.width * (obj.scaleX || 1),
                                height: obj.height * (obj.scaleY || 1),
                                fill: '#ffffff',
                                stroke: 'none',
                                selectable: false,
                                evented: false,
                                id: `cover_${Math.random().toString(36).substr(2, 9)}`,
                            });
                            (cover as any).isOriginalTextCover = true;
                            fCanvas.add(cover);
                        } else if (obj.isOriginalImage) {
                            // White cover hides original image in the rendered background
                            const cover = new fabric.Rect({
                                left: obj.originalLeft ?? obj.left,
                                top: obj.originalTop ?? obj.top,
                                width: obj.originalWidth ?? (obj.width * (obj.scaleX || 1)),
                                height: obj.originalHeight ?? (obj.height * (obj.scaleY || 1)),
                                fill: '#ffffff',
                                stroke: 'none',
                                selectable: false,
                                evented: false,
                                id: `imgcover_${Math.random().toString(36).substr(2, 9)}`,
                            });
                            (cover as any).isOriginalImageCover = true;
                            fCanvas.add(cover);
                            cover.sendToBack();
                        }
                        fCanvas.remove(obj);
                    });
                    fCanvas.requestRenderAll();

                    const json = fCanvas.toJSON(CUSTOM_PROPS);
                    dispatch({
                        type: 'SAVE_HISTORY',
                        payload: { pageNum, json }
                    });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch, pageNum]);

    // Handle clicks and drags based on tools
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;


        const handleMouseDown = (opt: any) => {
            if (activeTool === 'eraser' && opt.target) {
                const erasedObj = opt.target;

                // If erasing a PDF text or image object, leave a white cover behind
                if ((erasedObj as any).isOriginalText) {
                    const cover = new fabric.Rect({
                        left: erasedObj.left,
                        top: erasedObj.top,
                        width: erasedObj.width * (erasedObj.scaleX || 1),
                        height: erasedObj.height * (erasedObj.scaleY || 1),
                        fill: '#ffffff',
                        stroke: 'none',
                        selectable: false,
                        evented: false,
                        id: `cover_${Math.random().toString(36).substr(2, 9)}`,
                    });
                    (cover as any).isOriginalTextCover = true;
                    fCanvas.add(cover);
                } else if ((erasedObj as any).isOriginalImage) {
                    const cover = new fabric.Rect({
                        left: erasedObj.originalLeft ?? erasedObj.left,
                        top: erasedObj.originalTop ?? erasedObj.top,
                        width: erasedObj.originalWidth ?? (erasedObj.width * (erasedObj.scaleX || 1)),
                        height: erasedObj.originalHeight ?? (erasedObj.height * (erasedObj.scaleY || 1)),
                        fill: '#ffffff',
                        stroke: 'none',
                        selectable: false,
                        evented: false,
                        id: `imgcover_${Math.random().toString(36).substr(2, 9)}`,
                    });
                    (cover as any).isOriginalImageCover = true;
                    fCanvas.add(cover);
                    cover.sendToBack();
                }

                // Remove from multiple selection if it was part of one
                const activeObjects = fCanvas.getActiveObjects();
                if (activeObjects.includes(erasedObj)) {
                    fCanvas.discardActiveObject();
                }
                fCanvas.remove(erasedObj);

                // Trigger history save
                const json = fCanvas.toJSON(['id', 'isPdfForm', 'formType', 'isRedaction', 'isOriginalText', 'isOriginalTextCover', 'originalStr', 'isEdited']);
                dispatch({
                    type: 'SAVE_HISTORY',
                    payload: { pageNum, json }
                });

                // Stop the freehand path from starting if we explicitly clicked an object
                fCanvas.isDrawingMode = false;
                setTimeout(() => { if (activeTool === 'eraser') fCanvas.isDrawingMode = true; }, 100);
                return;
            }

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
            }
        };

        const handleMouseMove = () => {
        };

        const handleMouseUp = () => {
        };

        const handlePathCreated = (e: any) => {
            if (activeTool === 'eraser') {
                const path = e.path;
                path.set({
                    id: Math.random().toString(36).substr(2, 9),
                    isRedaction: true,
                });
                // History is automatically saved via object:added listener
            }
        };

        fCanvas.on('mouse:down', handleMouseDown);
        fCanvas.on('mouse:move', handleMouseMove);
        fCanvas.on('mouse:up', handleMouseUp);
        fCanvas.on('path:created', handlePathCreated);

        return () => {
            fCanvas.off('mouse:down', handleMouseDown);
            fCanvas.off('mouse:move', handleMouseMove);
            fCanvas.off('mouse:up', handleMouseUp);
            fCanvas.off('path:created', handlePathCreated);
        };
    }, [activeTool, dispatch, pageNum]);

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
