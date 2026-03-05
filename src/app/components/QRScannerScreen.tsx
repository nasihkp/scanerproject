import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, Image as ImageIcon, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerScreenProps {
    onBack: () => void;
}

export function QRScannerScreen({ onBack }: QRScannerScreenProps) {
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().then(() => {
                        scannerRef.current?.clear();
                    }).catch(err => console.error("Cleanup error", err));
                } else {
                    scannerRef.current.clear();
                }
            }
        };
    }, []);

    const getScanner = () => {
        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode("reader");
        }
        return scannerRef.current;
    };

    const startCamera = async () => {
        setError(null);
        const scanner = getScanner();

        try {
            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    setScanResult(decodedText);
                    stopCamera();
                },
                () => {
                    // ignore frame errors
                }
            );
            setIsScanning(true);
        } catch (err: any) {
            console.error("Start camera error:", err);
            setError(`Failed to start camera: ${err?.message || "Unknown error"}. Check permissions.`);
            setIsScanning(false);
        }
    };

    const stopCamera = async () => {
        const scanner = scannerRef.current;
        if (scanner && (isScanning || scanner.isScanning)) {
            try {
                await scanner.stop();
                setIsScanning(false);
                // Don't clear(), so we can restart usage if needed, or clear() if you want to remove video element
                // scanner.clear(); 
            } catch (err) {
                console.error("Failed to stop", err);
                // If it says "not running", just ignore
                setIsScanning(false);
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        const scanner = getScanner();

        scanner.scanFile(file, true)
            .then(decodedText => {
                setScanResult(decodedText);
                if (isScanning) stopCamera(); // Stop camera if running
            })
            .catch(err => {
                console.error(err);
                setError("Could not find a QR code in this image.");
            });
    };

    const handleCopy = () => {
        if (scanResult) {
            navigator.clipboard.writeText(scanResult);
            alert("Copied to clipboard!");
        }
    };

    const handleOpen = () => {
        if (scanResult) window.open(scanResult, '_blank');
    };

    return (
        <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* HEADER */}
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
                <button onClick={() => {
                    stopCamera();
                    onBack();
                }}>
                    <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                </button>
                <h2 className="font-semibold text-lg text-gray-900 dark:text-white">QR Scanner</h2>
            </div>

            <div className="flex-1 flex flex-col p-4 overflow-y-auto">

                {!scanResult ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6">

                        {/* QR READER CONTAINER */}
                        <div className="w-full max-w-sm rounded-xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 bg-black relative">
                            <div id="reader" className="w-full h-[350px]"></div>

                            {!isScanning && !error && (
                                <div className="absolute inset-0 flex items-center justify-center text-white/50 pointer-events-none">
                                    Camera is off
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center px-4 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg max-w-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4 flex-wrap justify-center">
                            {!isScanning ? (
                                <button
                                    onClick={startCamera}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                                >
                                    <Camera className="w-5 h-5" />
                                    Scan with Camera
                                </button>
                            ) : (
                                <button
                                    onClick={stopCamera}
                                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-full font-medium hover:bg-red-700 transition"
                                >
                                    Stop Camera
                                </button>
                            )}

                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-6 py-3 rounded-full font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                    Upload Image
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100 dark:border-gray-700">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ExternalLink className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>

                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Scanned Result</h3>
                            <p className="text-gray-600 dark:text-gray-300 break-all bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-6 text-sm font-mono">
                                {scanResult}
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleCopy}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                >
                                    <Copy className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Copy Text</span>
                                </button>
                                <button
                                    onClick={handleOpen}
                                    disabled={!scanResult.startsWith('http')}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition disabled:opacity-50"
                                >
                                    <ExternalLink className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Open Link</span>
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    setScanResult(null);
                                    // Optionally auto-restart camera?
                                }}
                                className="mt-6 w-full py-3 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
                            >
                                Scan Another
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
