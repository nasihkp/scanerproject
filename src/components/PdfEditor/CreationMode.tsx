import React from 'react';
import { FilePlus, LayoutTemplate, ImageIcon, ScanLine, Upload } from 'lucide-react';

interface CreationModeProps {
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCreateBlank: () => void;
}

export const CreationMode: React.FC<CreationModeProps> = ({ onFileUpload, onCreateBlank }) => {
    return (
        <div className="flex flex-col items-center justify-center w-full h-full text-white">
            <div className="max-w-3xl w-full p-8">
                <h2 className="text-3xl font-light mb-2 text-center">Create New PDF</h2>
                <p className="text-white/50 text-center mb-10">Choose an option to start a new document or open an existing file.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <label className="flex flex-col items-center justify-center gap-4 p-8 bg-[#1a1a1a] border border-white/5 rounded-2xl hover:bg-[#222] hover:border-[#3b82f6]/50 cursor-pointer transition-all duration-300 hover:-translate-y-1 group shadow-lg">
                        <div className="w-16 h-16 rounded-full bg-[#3b82f6]/10 flex items-center justify-center group-hover:bg-[#3b82f6]/20 transition-colors">
                            <Upload className="w-8 h-8 text-[#3b82f6]" />
                        </div>
                        <span className="font-medium text-lg text-white">Open File</span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={onFileUpload} />
                    </label>

                    <button
                        onClick={onCreateBlank}
                        className="flex flex-col items-center justify-center gap-4 p-8 bg-[#1a1a1a] border border-white/5 rounded-2xl hover:bg-[#222] hover:border-white/20 transition-all duration-300 hover:-translate-y-1 group shadow-lg">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <FilePlus className="w-8 h-8 text-white/70" />
                        </div>
                        <span className="font-medium text-lg text-white">Blank Document</span>
                    </button>

                    <button className="flex flex-col items-center justify-center gap-4 p-8 bg-[#1a1a1a] border border-white/5 rounded-2xl hover:bg-[#222] hover:border-white/20 transition-all duration-300 hover:-translate-y-1 group shadow-lg cursor-not-allowed opacity-50">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <LayoutTemplate className="w-8 h-8 text-white/70" />
                        </div>
                        <span className="font-medium text-lg text-white">From Template</span>
                    </button>

                    <button className="flex flex-col items-center justify-center gap-4 p-8 bg-[#1a1a1a] border border-white/5 rounded-2xl hover:bg-[#222] hover:border-white/20 transition-all duration-300 hover:-translate-y-1 group shadow-lg cursor-not-allowed opacity-50">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <ImageIcon className="w-8 h-8 text-white/70" />
                        </div>
                        <span className="font-medium text-lg text-white">From Images</span>
                    </button>
                </div>

                <div className="mt-12 flex justify-center">
                    <button className="flex items-center gap-3 px-6 py-3 bg-[#1a1a1a] border border-white/10 rounded-full hover:bg-white/5 transition-colors shadow">
                        <ScanLine className="w-5 h-5 text-white/70" />
                        <span className="font-medium">Scan with Camera</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
