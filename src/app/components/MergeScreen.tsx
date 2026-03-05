import { useState, useRef } from 'react';
import { ArrowLeft, Check, FileText, Plus, X } from 'lucide-react';
import { ScannedDoc } from '../types/types';

interface MergeScreenProps {
    scannedDocs: ScannedDoc[];
    onBack: () => void;
    onMerge: (selectedDocs: (ScannedDoc | File)[], fileName: string) => void;
}

type MergeItem =
    | { type: 'app-doc'; data: ScannedDoc }
    | { type: 'file'; data: File; id: string };

export function MergeScreen({ scannedDocs, onBack, onMerge }: MergeScreenProps) {
    const [selectedItems, setSelectedItems] = useState<MergeItem[]>([]);
    const [activeTab, setActiveTab] = useState<'app' | 'file'>('app');
    const [fileName, setFileName] = useState(`Merged_Scan_${new Date().getTime()}`);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleAppDoc = (doc: ScannedDoc) => {
        setSelectedItems(prev => {
            const exists = prev.find(item => item.type === 'app-doc' && item.data.id === doc.id);
            if (exists) {
                return prev.filter(item => !(item.type === 'app-doc' && item.data.id === doc.id));
            } else {
                return [...prev, { type: 'app-doc', data: doc }];
            }
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).map(file => ({
                type: 'file' as const,
                data: file,
                id: `file-${Date.now()}-${file.name}`
            }));
            setSelectedItems(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (id: string) => {
        setSelectedItems(prev => prev.filter(item => !(item.type === 'file' && item.id === id)));
    };

    const handleMerge = () => {
        if (selectedItems.length < 2) {
            alert("Please select at least 2 documents to merge.");
            return;
        }
        const docs = selectedItems.map(item => item.data);
        onMerge(docs, fileName);
    };

    return (
        <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Top Bar */}
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                <button onClick={onBack} className="p-2 text-gray-700 dark:text-gray-200">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-semibold text-gray-900 dark:text-white">Merge PDFs</h2>
                <button
                    onClick={handleMerge}
                    disabled={selectedItems.length < 2}
                    className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${selectedItems.length >= 2
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                        }`}
                >
                    Merge
                </button>
            </div>

            {/* File Name Input */}
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 block">
                    Output File Name
                </label>
                <div className="flex items-center gap-2">
                    <input
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Name your merged PDF..."
                    />
                    <FileText className="w-5 h-5 text-gray-400" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                    className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'app'
                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400"
                        }`}
                    onClick={() => setActiveTab('app')}
                >
                    Saved Scans ({scannedDocs.length})
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'file'
                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400"
                        }`}
                    onClick={() => setActiveTab('file')}
                >
                    Import Files
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'app' ? (
                    <div className="space-y-3">
                        {scannedDocs.length === 0 && (
                            <div className="text-center py-10 text-gray-500">No scanned documents yet.</div>
                        )}
                        {scannedDocs.map(doc => {
                            const isSelected = selectedItems.some(item => item.type === 'app-doc' && item.data.id === doc.id);
                            return (
                                <div
                                    key={doc.id}
                                    onClick={() => toggleAppDoc(doc)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"
                                        }`}>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>

                                    <div className="w-12 h-16 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                                        {doc.pages[0] ? (
                                            <img src={doc.pages[0]} alt="Thumbnail" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <FileText className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                            Scan {doc.date}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {doc.pages.length} pages
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                            <Plus className="w-6 h-6 mb-2" />
                            <span className="text-sm font-medium">Add PDF Files</span>
                        </button>

                        {selectedItems.filter(i => i.type === 'file').length > 0 && (
                            <div className="space-y-2 mt-4">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase">Selected External Files</h3>
                                {selectedItems.filter(i => i.type === 'file').map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded flex items-center justify-center text-red-600">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{item.data.name}</span>
                                        </div>
                                        <button onClick={() => removeFile(item.id)} className="p-1 text-gray-400 hover:text-red-500">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Summary Footer */}
            {(selectedItems.length > 0) && (
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-bold text-blue-600">{selectedItems.length}</span> documents selected
                    </div>
                </div>
            )}
        </div>
    );
}
