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

// ── PDF Object Decomposition Engine ──

interface DecomposedObject {
    type: 'text' | 'image' | 'path';
    data: any;
}

async function decomposePage(page: any, viewport: any, scale: number): Promise<DecomposedObject[]> {
    const results: DecomposedObject[] = [];
    try {
        const ops = await page.getOperatorList();
        const OPS = pdfjsLib.OPS;
        const ctmStack: number[][] = [];
        let ctm: number[] = [1, 0, 0, 1, 0, 0];

        let fillColor = '#000000';
        let strokeColor = '#000000';
        let lineWidth = 1;

        for (let i = 0; i < ops.fnArray.length; i++) {
            const fn = ops.fnArray[i];
            const args = ops.argsArray[i];

            if (fn === OPS.save) {
                ctmStack.push([...ctm]);
            } else if (fn === OPS.restore) {
                ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
            } else if (fn === OPS.transform) {
                ctm = multiplyMatrices(ctm, args as number[]);
            }
            else if (fn === OPS.setFillRGBColor) {
                const [r, g, b] = args as number[];
                fillColor = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
            }
            else if (fn === OPS.setStrokeRGBColor) {
                const [r, g, b] = args as number[];
                strokeColor = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
            }
            else if (fn === OPS.setLineWidth) {
                lineWidth = args[0] as number;
            }
            else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
                const imgName = args[0] as string;
                let imgObj: any = null;
                
                // 1. Try to get image from page objects first, then common objects
                try {
                    imgObj = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => resolve(null), 2000);
                        page.objs.get(imgName, (data: any) => {
                            if (data) { clearTimeout(timeout); resolve(data); }
                            else {
                                page.commonObjs.get(imgName, (commonData: any) => {
                                    clearTimeout(timeout);
                                    resolve(commonData);
                                });
                            }
                        });
                    });
                } catch (e) {
                    console.warn(`Error fetching image ${imgName}:`, e);
                }

                if (!imgObj) {
                    console.warn(`Image ${imgName} not found in objs or commonObjs`);
                    continue;
                }

                const fullCtm = multiplyMatrices(viewport.transform, ctm);
                
                // Calculate size and position from CTM
                // A PDF image is a [0,0,1,1] square. 
                // Transforming [0,0], [1,0], [1,1], [0,1] gives the 4 corners.
                const corners = [
                    [0, 0], [1, 0], [1, 1], [0, 1]
                ].map(([cx, cy]) => {
                    return [
                        fullCtm[0] * cx + fullCtm[2] * cy + fullCtm[4],
                        fullCtm[1] * cx + fullCtm[3] * cy + fullCtm[5]
                    ];
                });

                const minX = Math.min(...corners.map(c => c[0]));
                const minY = Math.min(...corners.map(c => c[1]));
                const maxX = Math.max(...corners.map(c => c[0]));
                const maxY = Math.max(...corners.map(c => c[1]));

                const w = maxX - minX;
                const h = maxY - minY;

                const offCanvas = document.createElement('canvas');
                const naturalW = imgObj.width || 100;
                const naturalH = imgObj.height || 100;
                offCanvas.width = naturalW;
                offCanvas.height = naturalH;
                const offCtx = offCanvas.getContext('2d');
                if (!offCtx) continue;

                // Handle ImageBitmap (modern PDF.js)
                if (imgObj.bitmap) {
                    offCtx.drawImage(imgObj.bitmap, 0, 0);
                } else if (imgObj.data) {
                    // Handle raw data (legacy/fallback)
                    const src = imgObj.data;
                    const dst = offCtx.createImageData(naturalW, naturalH);
                    const totalPx = naturalW * naturalH;
                    
                    if (src.length === totalPx * 3) {
                        // RGB
                        for (let p = 0; p < totalPx; p++) {
                            dst.data[p * 4] = src[p * 3];
                            dst.data[p * 4 + 1] = src[p * 3 + 1];
                            dst.data[p * 4 + 2] = src[p * 3 + 2];
                            dst.data[p * 4 + 3] = 255;
                        }
                    } else if (src.length === totalPx * 4) {
                        // RGBA
                        dst.data.set(src);
                    } else {
                        // Other formats - best effort
                        dst.data.set(src.length > dst.data.length ? src.slice(0, dst.data.length) : src);
                    }
                    offCtx.putImageData(dst, 0, 0);
                } else if (imgObj instanceof HTMLImageElement || imgObj instanceof HTMLCanvasElement) {
                    offCtx.drawImage(imgObj, 0, 0);
                } else {
                    console.warn(`Unsupported image object format for ${imgName}`);
                    continue;
                }

                results.push({
                    type: 'image',
                    data: {
                        id: `img_${Math.random().toString(36).substr(2, 9)}`,
                        left: minX,
                        top: minY,
                        width: w,
                        height: h,
                        dataUrl: offCanvas.toDataURL('image/png'),
                    }
                });
            }
            else if (fn === OPS.rectangle) {
                const [rx, ry, rw, rh] = args as number[];
                const [cx, cy] = viewport.convertToViewportPoint(rx, ry);
                const [cx2, cy2] = viewport.convertToViewportPoint(rx + rw, ry + rh);
                results.push({
                    type: 'path',
                    data: {
                        type: 'rect',
                        left: Math.min(cx, cx2),
                        top: Math.min(cy, cy2),
                        width: Math.abs(cx - cx2),
                        height: Math.abs(cy - cy2),
                        fill: fillColor,
                        stroke: strokeColor,
                        strokeWidth: lineWidth * scale,
                    }
                });
            }
        }

        const textContent = await page.getTextContent();
        textContent.items.forEach((item: any) => {
            if (!item.str || !item.str.trim()) return;
            const [cx, cy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            const fontH = Math.max((item.height ? item.height : Math.abs(item.transform[3])) * scale, 6);
            results.push({
                type: 'text',
                data: {
                    id: `txt_${Math.random().toString(36).substr(2, 9)}`,
                    str: item.str,
                    left: cx,
                    top: cy - fontH,
                    fontSize: fontH * 1.05
                }
            });
        });
    } catch (err) { console.warn('Decomposition failed:', err); }
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

    const isHistoryOperation = useRef<boolean>(false);
    const pristineStateJSON = useRef<any>(null);

    useEffect(() => {
        let isCancelled = false;

        const initPage = async () => {
            if (!pdfDoc || !canvasElementRef.current || !containerRef.current) return;

            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            try {
                // Initialize Fabric canvas if not already done
                if (!fabricCanvasRef.current) {
                    const fabricCanvas = new fabric.Canvas(canvasElementRef.current, {
                        width: viewport.width,
                        height: viewport.height,
                        selection: true,
                        backgroundColor: '#ffffff',
                        controlsAboveOverlay: true,
                        preserveObjectStacking: true,
                    });
                    fabricCanvasRef.current = fabricCanvas;
                    fabricCanvasRegistry[pageNum] = fabricCanvas;

                    // ── Full Decomposition: Text, Images, and Paths ──
                    const objects = await decomposePage(page, viewport, scale);
                    if (isCancelled) return;

                    for (const obj of objects) {
                        if (obj.type === 'text') {
                            const t = obj.data;
                            const textOverlay = new fabric.IText(t.str, {
                                left: t.left,
                                top: t.top,
                                fontSize: t.fontSize,
                                fontFamily: 'sans-serif',
                                fill: '#000000',
                                selectable: true,
                                evented: true,
                                id: t.id,
                                hasControls: true,
                                hasBorders: true,
                                lockRotation: true,
                                lockScalingX: true,
                                lockScalingY: true,
                                hoverCursor: 'text',
                            });
                            textOverlay.setControlsVisibility({
                                tl: false, tr: false, br: false, bl: false,
                                ml: false, mt: false, mr: false, mb: false,
                                mtr: false,
                            });
                            (textOverlay as any).isOriginalText = true;
                            (textOverlay as any).originalStr = t.str;
                            fabricCanvas.add(textOverlay);
                        }
                        else if (obj.type === 'image') {
                            const img = obj.data;
                            await new Promise<void>((resolve) => {
                                fabric.Image.fromURL(img.dataUrl, (fImg: any) => {
                                    if (!fImg || isCancelled) { resolve(); return; }
                                    fImg.set({
                                        left: img.left,
                                        top: img.top,
                                        scaleX: img.width / (fImg.width || 1),
                                        scaleY: img.height / (fImg.height || 1),
                                        id: img.id,
                                        selectable: true,
                                        evented: true,
                                        hoverCursor: 'move',
                                        hasControls: true,
                                        hasBorders: true,
                                        lockRotation: false,
                                        lockScalingX: false,
                                        lockScalingY: false,
                                        originalLeft: img.left,
                                        originalTop: img.top,
                                        originalWidth: img.width,
                                        originalHeight: img.height,
                                        cornerSize: 10,
                                        cornerColor: '#3b82f6',
                                        cornerStrokeColor: '#ffffff',
                                        transparentCorners: false,
                                    });
                                    (fImg as any).isOriginalImage = true;
                                    fabricCanvas.add(fImg);
                                    resolve();
                                });
                            });
                        }
                        else if (obj.type === 'path' && obj.data.type === 'rect') {
                            const rect = new fabric.Rect({
                                ...obj.data,
                                selectable: true,
                                evented: true,
                                id: `path_${Math.random().toString(36).substr(2, 5)}`,
                            });
                            fabricCanvas.add(rect);
                        }
                    }

                    fabricCanvas.renderAll();
                    pristineStateJSON.current = fabricCanvas.toJSON(CUSTOM_PROPS);

                    // Selection events
                    fabricCanvas.on('selection:created', (e: any) => {
                        if (e.selected && e.selected.length === 1) {
                            const obj = e.selected[0];
                            if (!obj.id) obj.id = Math.random().toString(36).substr(2, 9);
                            dispatch({
                                type: 'SET_SELECTED_ELEMENT',
                                payload: {
                                    id: obj.id,
                                    props: {
                                        type: obj.type, fill: obj.fill, stroke: obj.stroke,
                                        strokeWidth: obj.strokeWidth, fontSize: obj.fontSize,
                                        fontFamily: obj.fontFamily, text: obj.text,
                                        opacity: obj.opacity ?? 1, backgroundColor: obj.backgroundColor
                                    }
                                }
                            });
                        } else {
                            dispatch({ type: 'SET_SELECTED_ELEMENT', payload: { id: null } });
                        }
                    });

                    fabricCanvas.on('selection:updated', (e: any) => {
                        if (e.selected && e.selected.length === 1) {
                            const obj = e.selected[0];
                            if (!obj.id) obj.id = Math.random().toString(36).substr(2, 9);
                            dispatch({
                                type: 'SET_SELECTED_ELEMENT',
                                payload: {
                                    id: obj.id,
                                    props: {
                                        type: obj.type, fill: obj.fill, stroke: obj.stroke,
                                        strokeWidth: obj.strokeWidth, fontSize: obj.fontSize,
                                        fontFamily: obj.fontFamily, text: obj.text,
                                        opacity: obj.opacity ?? 1, backgroundColor: obj.backgroundColor
                                    }
                                }
                            });
                        }
                    });

                    fabricCanvas.on('selection:cleared', () => {
                        dispatch({ type: 'SET_SELECTED_ELEMENT', payload: { id: null } });
                    });

                    fabricCanvas.on('text:editing:entered', (e: any) => {
                        const obj = e.target;
                        if (obj && obj.isOriginalText && !obj.isEdited) {
                            obj.set({ isEdited: true });
                            fabricCanvas.renderAll();
                            const json = fabricCanvas.toJSON(CUSTOM_PROPS);
                            dispatch({ type: 'SAVE_HISTORY', payload: { pageNum, json } });
                        }
                    });

                } else {
                    const fCanvas = fabricCanvasRef.current;
                    fCanvas.setWidth(viewport.width);
                    fCanvas.setHeight(viewport.height);
                    fCanvas.renderAll();
                }

            } catch (err: any) {
                console.error(`Error decomposing page ${pageNum}:`, err);
            }
        };

        initPage();

        return () => {
            isCancelled = true;
            if (fabricCanvasRegistry[pageNum]) {
                delete fabricCanvasRegistry[pageNum];
            }
        };
    }, [pdfDoc, pageNum, scale, dispatch]);

    // Track Canvas Changes for History
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;

        const handleCanvasChange = (opt: any) => {
            if (isHistoryOperation.current) return;
            if (opt && opt.target && !opt.target.id) {
                opt.target.set({ id: Math.random().toString(36).substr(2, 9) });
            }
            const json = fCanvas.toJSON(CUSTOM_PROPS);
            dispatch({ type: 'SAVE_HISTORY', payload: { pageNum, json } });
        };

        fCanvas.on('object:modified', handleCanvasChange);
        fCanvas.on('object:added', handleCanvasChange);
        fCanvas.on('object:removed', handleCanvasChange);

        return () => {
            fCanvas.off('object:modified', handleCanvasChange);
            fCanvas.off('object:added', handleCanvasChange);
            fCanvas.off('object:removed', handleCanvasChange);
        };
    }, [dispatch, pageNum]);

    // Handle History Index Reversions (Undo/Redo)
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;

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

        fCanvas.isDrawingMode = false;
        fCanvas.selection = true;

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
                break;
            default:
                break;
        }
    }, [activeTool]);

    // Handle Keyboard Shortcuts (Delete/Backspace)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const fCanvas = fabricCanvasRef.current;
            if (!fCanvas) return;

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
                                selectable: false,
                                evented: false,
                            });
                            fCanvas.add(cover);
                        } else if (obj.isOriginalImage) {
                            const cover = new fabric.Rect({
                                left: obj.originalLeft,
                                top: obj.originalTop,
                                width: obj.originalWidth,
                                height: obj.originalHeight,
                                fill: '#ffffff',
                                selectable: false,
                                evented: false,
                            });
                            fCanvas.add(cover);
                            cover.sendToBack();
                        }
                        fCanvas.remove(obj);
                    });
                    fCanvas.requestRenderAll();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch, pageNum]);

    // Handle clicks for tools
    useEffect(() => {
        const fCanvas = fabricCanvasRef.current;
        if (!fCanvas) return;

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
                dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
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
            } else if (activeTool === 'image' && !opt.target) {
                const pointer = fCanvas.getPointer(opt.e);
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
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
                            img.scaleToWidth(250);
                            fCanvas.add(img);
                            fCanvas.setActiveObject(img);
                            dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
                        });
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            }
        };

        fCanvas.on('mouse:down', handleMouseDown);
        return () => fCanvas.off('mouse:down', handleMouseDown);
    }, [activeTool, dispatch]);

    // Handle global property updates
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
            if (changed) fCanvas.requestRenderAll();
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
