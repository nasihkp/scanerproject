import { useEffect, useRef, useState, ChangeEvent } from "react";
import { X, Zap, SwitchCamera, Image as ImageIcon, Check } from "lucide-react";

interface CameraScanScreenProps {
  onBack: () => void;
  onCapture: (images: string[]) => void;
}

export function CameraScanScreen({ onBack, onCapture }: CameraScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);

  /* ================= START CAMERA ================= */
  useEffect(() => {
    let activeStream: MediaStream;

    const startCamera = async () => {
      try {
        if (stream) stream.getTracks().forEach(t => t.stop());

        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });

        setStream(activeStream);

        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          videoRef.current.setAttribute("playsinline", "");
          videoRef.current.muted = true;
          await videoRef.current.play();
        }
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Camera access denied or unavailable");
      }
    };

    startCamera();

    return () => {
      activeStream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  /* ================= TORCH ================= */
  useEffect(() => {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    const cap: any = track.getCapabilities?.();

    if (cap?.torch) {
      track
        .applyConstraints({ advanced: [{ torch: flash } as any] })
        .catch(() => { });
    }
  }, [flash, stream]);

  /* ================= CAPTURE ================= */
  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.95);

    // Add to pages
    setPages(prev => [...prev, image]);

    setTimeout(() => setCapturing(false), 150);
  };

  /* ================= GALLERY IMPORT ================= */
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert FileList to Array
    const fileArray = Array.from(files);

    // Process all files
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === "string") {
          setPages(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Clear input
    e.target.value = '';
  };

  /* ================= UI ================= */
  if (error) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        multiple // Allow multiple selection
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      {capturing && (
        <div className="absolute inset-0 bg-white opacity-70 z-50" />
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-20">
        <button
          onClick={onBack}
          className="bg-black/50 p-2 rounded-full"
        >
          <X className="text-white" />
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => setFlash(f => !f)}
            className={`p-2 rounded-full ${flash ? "bg-yellow-400 text-black" : "bg-black/50 text-white"
              }`}
          >
            <Zap />
          </button>

          <button
            onClick={() =>
              setFacingMode(m => (m === "user" ? "environment" : "user"))
            }
            className="bg-black/50 p-2 rounded-full"
          >
            <SwitchCamera className="text-white" />
          </button>
        </div>
      </div>

      {/* CAPTURE BUTTON */}
      <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center z-20 gap-8">
        {/* GALLERY BUTTON */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center border border-white/20 active:scale-95 transition"
        >
          <ImageIcon className="text-white w-6 h-6" />
        </button>

        {/* SHUTTER BUTTON */}
        <button
          onClick={capture}
          disabled={capturing}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95"
        >
          <div className="w-14 h-14 bg-white rounded-full" />
        </button>

        {/* SPACER FOR SYMMETRY (optional, or could add another button later) */}
        {/* DONE BUTTON */}
        {pages.length > 0 ? (
          <button
            onClick={() => onCapture(pages)}
            className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg active:scale-95 transition"
          >
            <Check className="text-white w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-black">
              {pages.length}
            </span>
          </button>
        ) : (
          <div className="w-12 h-12" />
        )}
      </div>
    </div>
  );
}
