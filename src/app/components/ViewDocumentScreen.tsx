import { ArrowLeft, Share2, Trash2, Edit2 } from "lucide-react";
import { ScannedDoc } from "../types/types";

interface ViewDocumentScreenProps {
  doc: ScannedDoc;
  onBack: () => void;
  onDelete: (id: string) => void;
  onShare: (doc: ScannedDoc) => void;
  onEdit: (doc: ScannedDoc) => void;
  onEditPage: (doc: ScannedDoc, index: number) => void;
  onAdvancedEdit: (doc: ScannedDoc) => void;
}

// ... existing interfaces ...

export function ViewDocumentScreen({
  doc,
  onBack,
  onDelete,
  onShare,
  onEdit,
  onEditPage,
  onAdvancedEdit,
}: ViewDocumentScreenProps) {


  return (
    <div className="h-screen w-full bg-gray-900 flex flex-col relative">
      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 flex items-center justify-between z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => onDelete(doc.id)}
            className="w-10 h-10 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center text-red-400 hover:bg-red-500/40 transition"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* IMAGE DISPLAY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {doc.pages.map((page, index) => (
          <div key={index} className="relative shadow-2xl rounded-lg group">
            <img
              src={page}
              alt={`Page ${index + 1}`}
              className="w-full h-auto rounded-lg"
            />
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {index + 1}
            </div>

            {/* Edit Overlay */}
            <button
              onClick={() => onEditPage(doc, index)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
            >
              <div className="bg-white text-gray-900 rounded-full px-4 py-2 font-semibold flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Edit Page {index + 1}
              </div>
            </button>
            <div onClick={() => onEditPage(doc, index)} className="absolute bottom-2 right-2 md:hidden bg-white text-gray-900 rounded-full p-2 shadow-lg">
              <Edit2 className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM INFO BAR */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] mb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Scanned Document</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{doc.date}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {/* Primary Action: Summarize */}
          <button
            onClick={() => onAdvancedEdit(doc)}
            className="w-full bg-[#3b82f6] hover:bg-blue-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Edit2 className="w-5 h-5" />
            Advanced PDF Edit
          </button>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={() => onEdit(doc)}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              <Edit2 className="w-5 h-5" />
              Basic Edit
            </button>

            <button
              onClick={() => onShare(doc)}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition"
            >
              <Share2 className="w-5 h-5" />
              Share / PDF
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY MODAL */}


    </div>
  );
}
