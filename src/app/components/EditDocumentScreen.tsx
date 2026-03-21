import { useState } from "react";
import {
  ArrowLeft,
  Crop,
  RotateCw,
  Filter,
  Sun,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import ReactCrop, { type Crop as ReactCropType, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { detectDocumentEdges } from '../utils/edgeDetection';

interface EditDocumentScreenProps {
  pages: string[];
  initialPage?: number;
  onBack: () => void;
  onNext: (editedPages: string[]) => void;
  onAddPage: (currentPages: string[]) => void;
}

export function EditDocumentScreen({
  pages,
  initialPage = 0,
  onBack,
  onNext,
  onAddPage,
}: EditDocumentScreenProps) {
  const [currentPages, setCurrentPages] = useState<string[]>(pages);
  const [currentIndex, setCurrentIndex] = useState(initialPage);
  const [editedImage, setEditedImage] = useState(pages[0]);
  const [rotation, setRotation] = useState(0);

  const [activeTool, setActiveTool] = useState<"none" | "adjust" | "crop" | "filter">("none");
  const [brightness, setBrightness] = useState(100);

  /* FILTER STATE */
  const [preFilterImage, setPreFilterImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("original");

  /* CROP STATE */
  const [crop, setCrop] = useState<ReactCropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);

  /* PAGE NAVIGATION */
  const handlePageChange = (newIndex: number) => {
    // Save current changes
    const newPages = [...currentPages];
    newPages[currentIndex] = editedImage;
    setCurrentPages(newPages);

    // Switch
    setCurrentIndex(newIndex);
    setEditedImage(newPages[newIndex]);

    // Reset states
    setActiveTool("none");
    setCrop(undefined);
    setPreFilterImage(null);
    setRotation(0);
  };

  /* APPLY MANUAL CROP */
  const applyManualCrop = () => {
    if (!completedCrop || !imgRef) return;

    const canvas = document.createElement("canvas");
    const scaleX = imgRef.naturalWidth / imgRef.width;
    const scaleY = imgRef.naturalHeight / imgRef.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      imgRef,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    setEditedImage(canvas.toDataURL("image/jpeg", 0.95));
    setActiveTool("none");
    setCrop(undefined); // Reset crop
  };

  /* ROTATE IMAGE */
  const rotateImage = () => {
    const img = new Image();
    img.src = editedImage;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const angle = (rotation + 90) % 360;

      canvas.width = img.height;
      canvas.height = img.width;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      setRotation(angle);
      setEditedImage(canvas.toDataURL("image/jpeg", 0.95));
    };
  };

  /* APPLY FILTER */
  const applyFilter = (filterType: "original" | "grayscale" | "magic" | "bw" | "lighten") => {
    if (!preFilterImage) return;

    // If original, just restore
    if (filterType === "original") {
      setEditedImage(preFilterImage);
      setActiveFilter("original");
      return;
    }

    const img = new Image();
    img.src = preFilterImage;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original first
      ctx.drawImage(img, 0, 0);

      // Get image data for pixel manipulation if needed, or use CSS filters
      // Using context filters for performance and simplicity where possible

      const tempData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = tempData.data;

      if (filterType === "grayscale") {
        // Standard Grayscale
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
        }
        ctx.putImageData(tempData, 0, 0);
      }
      else if (filterType === "magic") {
        // High contrast + Saturation boost
        // We can use CSS filter string on context for this
        ctx.save();
        ctx.filter = "contrast(1.4) saturate(1.8) brightness(1.1)";
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      }
      else if (filterType === "bw") {
        // Threshold B&W (Binary-ish)
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const val = avg > 128 ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        ctx.putImageData(tempData, 0, 0);
      }
      else if (filterType === "lighten") {
        // Gamma / Brightness
        ctx.save();
        ctx.filter = "brightness(1.3) contrast(1.1)";
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      }

      setEditedImage(canvas.toDataURL("image/jpeg", 0.95));
      setActiveFilter(filterType);
    };
  };

  /* START FILTERING */
  const startFiltering = () => {
    setPreFilterImage(editedImage);
    setActiveFilter("original");
    setActiveTool("filter");
  };

  /* CANCEL FILTERING */
  const cancelFiltering = () => {
    if (preFilterImage) {
      setEditedImage(preFilterImage);
    }
    setPreFilterImage(null);
    setActiveTool("none");
  };

  /* CONFIRM FILTERING */
  const confirmFiltering = () => {
    setPreFilterImage(null);
    setActiveTool("none");
  };

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* TOP BAR */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button onClick={onBack} className="text-gray-700 dark:text-white flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => {
              // Save current state first
              const newPages = [...currentPages];
              newPages[currentIndex] = editedImage;
              onAddPage(newPages);
            }}
            className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Page
          </button>

          <button
            onClick={() => {
              const newPages = [...currentPages];
              newPages[currentIndex] = editedImage;
              onNext(newPages);
            }}
            className="text-white font-semibold flex items-center justify-center gap-1 bg-blue-600 px-3 py-2 sm:py-1 rounded-lg hover:bg-blue-700 transition"
          >
            Save PDF
          </button>
        </div>
      </div>

      {/* TOOL CONTROLS */}
      {activeTool === "adjust" && (
        <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-gray-700 dark:text-white text-sm mb-2">
            <span>Brightness</span>
            <span>{brightness}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="150"
            value={brightness}
            onChange={(e) => {
              const val = Number(e.target.value);
              setBrightness(val);
            }}
            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}

      {/* IMAGE PREVIEW */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden bg-gray-100 dark:bg-black/40 relative">

        {/* PREV BUTTON */}
        {currentPages.length > 1 && (
          <button
            disabled={currentIndex === 0}
            onClick={() => handlePageChange(currentIndex - 1)}
            className={`absolute left-2 z-10 p-2 rounded-full bg-white/80 dark:bg-black/50 text-gray-800 dark:text-white shadow-lg ${currentIndex === 0 ? 'opacity-30' : 'hover:bg-white dark:hover:bg-black/70'}`}
          >
            <ChevronLeft />
          </button>
        )}

        {/* NEXT BUTTON */}
        {currentPages.length > 1 && (
          <button
            disabled={currentIndex === currentPages.length - 1}
            onClick={() => handlePageChange(currentIndex + 1)}
            className={`absolute right-2 z-10 p-2 rounded-full bg-white/80 dark:bg-black/50 text-gray-800 dark:text-white shadow-lg ${currentIndex === currentPages.length - 1 ? 'opacity-30' : 'hover:bg-white dark:hover:bg-black/70'}`}
          >
            <ChevronRight />
          </button>
        )}

        {/* PAGE INDICATOR */}
        {currentPages.length > 1 && (
          <div className="absolute top-4 z-10 bg-white/80 dark:bg-black/50 px-3 py-1 rounded-full text-gray-800 dark:text-white text-xs font-medium shadow-sm">
            Page {currentIndex + 1} / {currentPages.length}
          </div>
        )}

        {activeTool === 'crop' ? (
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={undefined}
          >
            <img
              src={editedImage}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgRef(img);

                // Initialize crop if not set
                if (!crop) {
                  const width = img.width;
                  const height = img.height;
                  const defaultCrop: ReactCropType = {
                    unit: 'px',
                    x: width * 0.05,
                    y: height * 0.05,
                    width: width * 0.9,
                    height: height * 0.9
                  };
                  setCrop(defaultCrop);
                  setCompletedCrop({ ...defaultCrop, unit: 'px' } as PixelCrop);
                }
              }}
              className="max-h-[70vh] max-w-full rounded shadow-2xl"
            />
          </ReactCrop>
        ) : (
          <img
            src={editedImage}
            className="max-h-full max-w-full rounded-lg shadow-2xl transition duration-100"
            style={{
              filter: `brightness(${brightness}%)`
            }}
          />
        )}
      </div>

      {/* TOOLS */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {activeTool === "none" ? (
            <div className="flex justify-around text-gray-700 dark:text-white">
              <Tool icon={Crop} label="Crop" onClick={() => setActiveTool("crop")} />
              <Tool icon={RotateCw} label="Rotate" onClick={rotateImage} />
              <Tool icon={Filter} label="Filters" onClick={startFiltering} />
              <Tool icon={Sun} label="Adjust" onClick={() => setActiveTool("adjust")} />
            </div>
          ) : activeTool === "crop" ? (
            <div className="flex gap-4 justify-center items-center">
              <button
                onClick={async () => {
                  const autoCrop = await detectDocumentEdges(editedImage);
                  if (autoCrop && imgRef) {
                    // Convert % to pixels
                    const width = imgRef.width;
                    const height = imgRef.height;

                    const newCrop: ReactCropType = {
                      unit: 'px',
                      x: (autoCrop.x / 100) * width,
                      y: (autoCrop.y / 100) * height,
                      width: (autoCrop.width / 100) * width,
                      height: (autoCrop.height / 100) * height,
                    };
                    setCrop(newCrop);
                    setCompletedCrop({ ...newCrop, unit: 'px' } as PixelCrop);
                  }
                }}
                className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full font-medium text-sm flex items-center gap-1"
              >
                ✨ Auto
              </button>
              <button
                onClick={() => setActiveTool("none")}
                className="text-gray-700 dark:text-white bg-gray-200 dark:bg-gray-600 px-6 py-2 rounded-full font-medium"
              >
                Cancel
              </button>
              <button
                onClick={applyManualCrop}
                className="text-white bg-blue-600 px-6 py-2 rounded-full font-medium hover:bg-blue-700"
              >
                Apply Crop
              </button>
            </div>
          ) : activeTool === "filter" ? (
            <div className="w-full">
              {/* Filter List */}
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide justify-center">
                <FilterOption
                  label="Original"
                  type="original"
                  active={activeFilter === "original"}
                  onClick={() => applyFilter("original")}
                />
                <FilterOption
                  label="Magic Color"
                  type="magic"
                  active={activeFilter === "magic"}
                  onClick={() => applyFilter("magic")}
                />
                <FilterOption
                  label="B&W"
                  type="bw"
                  active={activeFilter === "bw"}
                  onClick={() => applyFilter("bw")}
                />
                <FilterOption
                  label="Grayscale"
                  type="grayscale"
                  active={activeFilter === "grayscale"}
                  onClick={() => applyFilter("grayscale")}
                />
                <FilterOption
                  label="Lighten"
                  type="lighten"
                  active={activeFilter === "lighten"}
                  onClick={() => applyFilter("lighten")}
                />
              </div>

              <div className="flex gap-4 justify-center border-t border-gray-200 dark:border-gray-800 pt-4">
                <button
                  onClick={cancelFiltering}
                  className="text-gray-700 dark:text-white bg-gray-200 dark:bg-gray-600 px-6 py-2 rounded-full font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmFiltering}
                  className="text-white bg-blue-600 px-6 py-2 rounded-full font-medium hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setActiveTool("none")}
                className="text-white bg-blue-600 px-6 py-2 rounded-full font-medium hover:bg-blue-700"
              >
                Done Adjusting
              </button>
            </div>
          )}
        </div>
      </div>

      {/* APPLY */}
      <div className="px-4 pb-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto pt-4">
          <button
            onClick={() => {
              const newPages = [...currentPages];
              newPages[currentIndex] = editedImage;
              onNext(newPages);
            }}
            className="w-full bg-blue-600 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-white hover:bg-blue-700 transition shadow-lg hover:shadow-xl hover:scale-[1.01]"
          >
            <Check className="w-5 h-5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* TOOL BUTTON */
function Tool({
  icon: Icon,
  label,
  onClick,
  disabled,
}: any) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-2 ${disabled ? "opacity-40" : "hover:text-blue-600 dark:hover:text-blue-400"
        }`}
    >
      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-700 dark:text-white">
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
/* FILTER OPTION COMPONENT */
function FilterOption({ label, type, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center gap-2 ${active ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
    >
      <div className={`w-16 h-16 rounded-lg ${active ? 'ring-2 ring-blue-500' : 'border border-gray-300 dark:border-gray-600'} overflow-hidden relative bg-gray-100 dark:bg-gray-800`}>
        {/* Preview Placeholder - in a real app would perform preview on small thumbnail */}
        <div className={`w-full h-full flex items-center justify-center text-[10px] text-gray-500 dark:text-gray-400 font-medium ${type === 'magic' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-200' : type === 'bw' ? 'bg-gray-900 text-white' : ''} `}>
          {type === 'magic' ? '✨' : type === 'bw' ? 'B&W' : type === 'lighten' ? '☀️' : type.slice(0, 2).toUpperCase()}
        </div>
      </div>
      <span className={`text-xs ${active ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>{label}</span>
    </button>
  )
}
