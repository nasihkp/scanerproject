import { useState } from "react";
import {
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  FileText,
  GripHorizontal
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PDFPreviewScreenProps {
  images: string[];          // REAL scanned images
  onBack: () => void;
  onSave: (fileName: string, images: string[], password?: string) => void;
  onAddPage: (currentPages: string[]) => void;
  onEditPage: (index: number) => void;
  onAdvancedEdit?: (fileName: string, images: string[], password?: string) => void;
  initialFileName?: string;
}

interface Page {
  id: string;
  image: string;
  sizeKB: number;
}

export function PDFPreviewScreen({
  images,
  onBack,
  onSave,
  onAddPage,
  onEditPage,
  onAdvancedEdit,
  initialFileName,
}: PDFPreviewScreenProps) {
  const [fileName, setFileName] = useState(initialFileName || "Scanned_Document");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [pages, setPages] = useState<Page[]>(
    images.map((img) => ({
      id: crypto.randomUUID(),
      image: img,
      sizeKB: Math.round(img.length / 1024), // rough estimate
    }))
  );

  /* DND SENSORS */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /* HANDLE DRAG END */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const totalSizeMB = (
    pages.reduce((sum, p) => sum + p.sizeKB, 0) / 1024
  ).toFixed(2);

  /* DELETE PAGE */
  const deletePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  /* ADD PAGE */
  const addPage = () => {
    // Pass current images back to app to retain them
    onAddPage(pages.map(p => p.image));
  };

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* TOP BAR */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <button onClick={onBack} className="text-gray-700 dark:text-gray-200">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h2 className="font-semibold text-gray-900 dark:text-white">PDF Preview</h2>
        <div className="w-6" />
      </div>

      {/* ACTIONS BAR */}
      <div className="bg-white dark:bg-gray-800 px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center gap-4">
        {/* FILE NAME */}
        <div className="flex-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 block">
            File Name
          </label>
          <div className="flex items-center gap-2">
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
            <Edit2 className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* PAGES */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pages.map((page, index) => (
                <SortablePageItem
                  key={page.id}
                  page={page}
                  index={index}
                  onEdit={() => onEditPage(index)}
                  onDelete={() => deletePage(page.id)}
                />
              ))}

              {/* ADD PAGE BUTTON */}
              <button
                onClick={addPage}
                className="aspect-[3/4] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <Plus className="w-8 h-8" />
                <span className="text-xs font-semibold">Add Page</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* FOOTER */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-5 py-4">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
          <span>{pages.length} pages</span>
          <span>Total size: {totalSizeMB} MB</span>
        </div>

        {/* Password Protection */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="protect-pdf"
              checked={isPasswordProtected}
              onChange={(e) => {
                setIsPasswordProtected(e.target.checked);
                if (!e.target.checked) setPassword("");
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="protect-pdf" className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer">
              Password Protect PDF
            </label>
          </div>

          {isPasswordProtected && (
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white mb-2"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() =>
              onSave(fileName, pages.map((p) => p.image), isPasswordProtected ? password : undefined)
            }
            className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition"
          >
            <FileText className="w-5 h-5" />
            Save as PDF
          </button>

          {onAdvancedEdit && (
            <button
              onClick={() =>
                onAdvancedEdit(fileName, pages.map((p) => p.image), isPasswordProtected ? password : undefined)
              }
              className="flex-1 bg-[#3b82f6] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition"
              title="Open in Full PDF Editor"
            >
              <Edit2 className="w-5 h-5" />
              Advanced Editor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* SORTABLE ITEM COMPONENT */
function SortablePageItem({ page, index, onEdit, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm flex flex-col gap-2 relative group touch-none select-none ${isDragging ? 'ring-2 ring-blue-500 shadow-xl scale-105' : ''}`}
      {...attributes}
      {...listeners}
    >
      {/* THUMBNAIL */}
      <div className="aspect-[3/4] w-full bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border dark:border-gray-600 relative">
        <img
          src={page.image}
          alt={`Page ${index + 1}`}
          className="w-full h-full object-cover pointer-events-none"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            /* Stop propagation to prevent drag start */
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 bg-white rounded-full text-blue-600 hover:scale-110 transition cursor-pointer"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            /* Stop propagation to prevent drag start */
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 bg-white rounded-full text-red-600 hover:scale-110 transition cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {/* DRAG HANDLE INDICATOR (Optional visual queue) */}
        <div className="absolute top-1 right-1 bg-black/20 rounded p-0.5 md:hidden">
          <GripHorizontal className="w-3 h-3 text-white" />
        </div>
      </div>

      {/* INFO */}
      <div className="text-center">
        <h3 className="font-semibold text-xs text-gray-900 dark:text-white">
          Page {index + 1}
        </h3>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          {page.sizeKB} KB
        </p>
      </div>
    </div>
  );
}
