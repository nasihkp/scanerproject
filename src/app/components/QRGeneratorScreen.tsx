import { useState, useRef } from 'react';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface QRGeneratorScreenProps {
    onBack: () => void;
}

export function QRGeneratorScreen({ onBack }: QRGeneratorScreenProps) {
    const [text, setText] = useState('');
    const qrRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (canvas) {
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = url;
            link.download = 'qrcode.png';
            link.click();
        }
    };

    const handleShare = async () => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (canvas) {
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], 'qrcode.png', { type: 'image/png' });
                if (navigator.share && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'QR Code',
                            text: text
                        });
                    } catch (err) {
                        console.error(err);
                    }
                } else {
                    alert("Sharing not supported on this device.");
                }
            });
        }
    };

    return (
        <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* HEADER */}
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
                <button onClick={onBack}>
                    <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                </button>
                <h2 className="font-semibold text-lg text-gray-900 dark:text-white">QR Generator</h2>
            </div>

            <div className="flex-1 p-6 flex flex-col items-center gap-8 overflow-y-auto">

                <div className="w-full max-w-md">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Enter Text or URL
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                </div>

                {text && (
                    <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
                        <div ref={qrRef} className="p-4 bg-white rounded-xl shadow-lg">
                            <QRCodeCanvas
                                value={text}
                                size={200}
                                level={"H"}
                                includeMargin={true}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-700 transition"
                            >
                                <Download className="w-5 h-5" />
                                Save Image
                            </button>
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-full font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                            >
                                <Share2 className="w-5 h-5" />
                                Share
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
