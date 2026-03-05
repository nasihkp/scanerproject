import React, { useState, useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { perspectiveWarp, type Point } from "../utils/imageProcessing";

interface SmartCropperProps {
    image: string;
    onComplete: (croppedImage: string) => void;
    onCancel: () => void;
}

export function SmartCropper({ image, onComplete, onCancel }: SmartCropperProps) {
    const [points, setPoints] = useState<Point[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    // Initialize points 10% in from edges
    useEffect(() => {
        if (!points.length) return;
        // Wait for image load to set initial points? 
        // We do it in onLoad of img
    }, []);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const w = img.width;
        const h = img.height;

        // Default: 4 corners inset by 10%
        setPoints([
            { x: w * 0.1, y: h * 0.1 },        // Top Left
            { x: w * 0.9, y: h * 0.1 },        // Top Right
            { x: w * 0.9, y: h * 0.9 },        // Bottom Right
            { x: w * 0.1, y: h * 0.9 },        // Bottom Left
        ]);
    };

    /* TOUCH / MOUSE HANDLING */
    const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
        if (!imgRef.current) return { x: 0, y: 0 };
        const rect = imgRef.current.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (draggingIdx === null) return;
        const pos = getPointerPos(e);

        // Constrain to image bounds
        if (!imgRef.current) return;
        const w = imgRef.current.width;
        const h = imgRef.current.height;

        const x = Math.max(0, Math.min(w, pos.x));
        const y = Math.max(0, Math.min(h, pos.y));

        setPoints(prev => {
            const next = [...prev];
            next[draggingIdx] = { x, y };
            return next;
        });
    };

    const handleEnd = () => {
        setDraggingIdx(null);
    };

    const handleApply = async () => {
        if (!imgRef.current) return;
        setProcessing(true);

        try {
            // Map UI points (which are scaled to current display size) back to natural size
            const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
            const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

            const naturalPoints = points.map(p => ({
                x: p.x * scaleX,
                y: p.y * scaleY
            }));

            const result = await perspectiveWarp(image, naturalPoints);
            onComplete(result);
        } catch (err) {
            console.error(err);
            alert("Failed to crop");
            setProcessing(false);
        }
    };

    return (
        <div
            className="absolute inset-0 bg-black z-50 flex flex-col"
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
        >
            {/* HEADER */}
            <div className="flex items-center justify-between p-4 bg-gray-900 text-white z-10">
                <button onClick={onCancel} className="p-2">
                    <X />
                </button>
                <h3 className="font-semibold">Smart Crop</h3>
                <button onClick={handleApply} disabled={processing} className="p-2 text-blue-400 font-bold">
                    {processing ? "..." : <Check />}
                </button>
            </div>

            {/* EDITOR */}
            <div className="flex-1 overflow-hidden relative flex items-center justify-center p-8 bg-gray-900" ref={containerRef}>
                <div className="relative inline-block select-none touch-none">
                    <img
                        ref={imgRef}
                        src={image}
                        onLoad={handleImageLoad}
                        className="max-h-[70vh] max-w-full pointer-events-none select-none touch-none"
                        draggable={false}
                    />

                    {/* OVERLAY */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
                        {/* Polygon Path */}
                        {points.length === 4 && (
                            <path
                                d={`M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y} Z`}
                                fill="rgba(59, 130, 246, 0.2)"
                                stroke="#3b82f6"
                                strokeWidth="2"
                            />
                        )}
                    </svg>

                    {/* HANDLES */}
                    {points.map((p, i) => (
                        <div
                            key={i}
                            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-blue-500 border-2 border-white cursor-move z-20 flex items-center justify-center shadow-lg"
                            style={{ left: p.x, top: p.y }}
                            onMouseDown={(e) => { e.stopPropagation(); setDraggingIdx(i); }}
                            onTouchStart={(e) => { e.stopPropagation(); setDraggingIdx(i); }}
                        >
                            {/* Touch target expansion */}
                            <div className="w-12 h-12 absolute bg-transparent" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900 p-4 text-center text-gray-400 text-sm">
                Drag corners to align with document edges
            </div>
        </div>
    );
}
