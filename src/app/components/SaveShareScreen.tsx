import {
  ArrowLeft,
  Download,
  Share2,
  Printer,
  Check,
  FileText,
  Cloud,
  Loader2,
  RefreshCw,
  Edit2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useGoogleDrive } from "../hooks/useGoogleDrive";
import { useAuth } from "../hooks/useAuth";

interface SaveShareScreenProps {
  pdfUrl: string;          // real generated PDF URL
  fileName: string;        // dynamic file name
  images: string[];        // source images for conversion
  scannedText?: string;    // OCR text for Excel export
  onBack: () => void;
  onComplete: () => void;
  onEdit: () => void;
}

export function SaveShareScreen({
  pdfUrl,
  fileName,
  images,
  scannedText,
  onBack,
  onComplete,
  onEdit,
}: SaveShareScreenProps) {
  const { uploadDocument, uploadProgress, error: driveError } = useGoogleDrive();
  const { signInWithGoogle, user } = useAuth();
  const [uploadedToDrive, setUploadedToDrive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Combine errors
  const displayError = localError || driveError;

  // Auto-upload to Google Drive when component mounts or user signs in
  useEffect(() => {
    const uploadToDrive = async () => {
      // If already uploaded, don't try again
      if (uploadedToDrive) return;
      // If currently uploading, don't interfere
      if (isUploading) return;

      setIsUploading(true);
      setLocalError(null);
      try {
        // Convert PDF URL to Blob
        const response = await fetch(pdfUrl);
        const blob = await response.blob();

        // Upload to Google Drive
        const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const result = await uploadDocument(blob, pdfFileName, 'application/pdf');

        if (result) {
          setUploadedToDrive(true);
        }
        // If result is null, hook sets its own error, no need to throw here
      } catch (error: any) {
        console.error('Failed to upload to Google Drive:', error);
        setLocalError(error.message || "Failed to upload to Drive");
      } finally {
        setIsUploading(false);
      }
    };

    uploadToDrive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Retry when user changes (e.g. signs in)

  const handleRetryUpload = () => {
    setUploadedToDrive(false);
    setIsUploading(false); // Reset to trigger effect? 
    // Actually effect depends on [] (mount), so we need a manual trigger function
    manualUpload();
  };

  const manualUpload = async () => {
    setIsUploading(true);
    setLocalError(null);
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const result = await uploadDocument(blob, pdfFileName, 'application/pdf');
      if (result) setUploadedToDrive(true);
      // If failed, hook sets error
    } catch (error: any) {
      setLocalError(error.message || "Retry failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReconnect = async () => {
    try {
      await signInWithGoogle();
      // Side effect: user changes -> useEffect triggers uploadToDrive
    } catch (err) {
      console.error("Reconnect failed", err);
      setLocalError("Reconnect failed. Please try again.");
    }
  };

  /* DOWNLOAD */
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = fileName;
    link.click();
  };

  /* SHARE */
  const handleShare = async () => {
    try {
      // 1. Fetch the blob from the URL
      const response = await fetch(pdfUrl);
      const blob = await response.blob();

      // 2. Create a File object
      const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const file = new File([blob], pdfFileName, { type: 'application/pdf' });

      // 3. Check for Web Share API support
      if (navigator.share) {
        const shareData = {
          files: [file],
          title: fileName,
          text: "Here is a scanned document for you.",
        };

        // Check if the device specifically supports sharing THIS file type
        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
        } else {
          // Fallback: Try sharing just the URL (less reliable for blobs) or alert
          await navigator.share({
            title: fileName,
            text: "Scanned document",
            url: pdfUrl
          });
        }
      } else {
        alert("Sharing is not supported on this browser/device.");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Share failed", err);
        // Fallback for desktop or unsupported environments: Download it
        // handleDownload();
      }
    }
  };

  /* PRINT */
  const handlePrint = () => {
    const win = window.open(pdfUrl);
    if (!win) return;
    win.onload = () => win.print();
  };



  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col relative">
      {/* TOP BAR */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button onClick={onBack}>
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
        <h2 className="flex-1 text-center font-semibold text-gray-900 dark:text-white">
          Save & Share
        </h2>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto">
        {/* SUCCESS */}
        <div className="bg-white dark:bg-gray-800 px-5 py-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Document Ready</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your PDF has been created
              </p>
            </div>
          </div>
        </div>

        {/* FILE INFO */}
        <div className="bg-white dark:bg-gray-800 mx-5 mt-5 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex gap-3">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm truncate text-gray-900 dark:text-white">
                {fileName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PDF document
              </p>
            </div>
          </div>

          {/* Google Drive Status */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            {isUploading ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                <span className="text-blue-600 dark:text-blue-400">Uploading to Google Drive... {uploadProgress}%</span>
              </div>
            ) : uploadedToDrive ? (
              <div className="flex items-center gap-2 text-sm">
                <Cloud className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400 font-medium">Saved to Google Drive</span>
              </div>
            ) : displayError ? (
              <div>
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-2">
                  <Cloud className="w-4 h-4" />
                  <span className="font-medium">Upload Failed: {displayError}</span>
                </div>

                {(displayError?.includes('401') || displayError?.includes('Unauthorized') || displayError?.includes('User not authenticated')) ? (
                  <button
                    onClick={handleReconnect}
                    className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition font-medium flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {displayError?.includes('User not authenticated') ? "Sign In to Drive" : "Reconnect Google Drive"}
                  </button>
                ) : (
                  <button
                    onClick={handleRetryUpload}
                    className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition font-medium"
                  >
                    Retry Upload
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Cloud className="w-4 h-4" />
                <span>Waiting to upload...</span>
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="px-5 py-6">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Quick Actions
          </h3>

          <div className="space-y-3">


            <ActionButton
              icon={<Download className="text-blue-600 dark:text-blue-400" />}
              title="Save to Device"
              desc="Download PDF"
              onClick={handleDownload}
            />

            <ActionButton
              icon={<FileText className="text-purple-600 dark:text-purple-400" />}
              title="View PDF"
              desc="Open in browser"
              onClick={() => window.open(pdfUrl, '_blank')}
            />

            <ActionButton
              icon={<Share2 className="text-green-600 dark:text-green-400" />}
              title="Share Document"
              desc="Share via apps"
              onClick={handleShare}
            />

            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-6 mb-3">
              Export As
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={async () => {
                  const { exportToWord } = await import("../utils/converters");
                  const blob = await exportToWord(images);
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${fileName}.docx`;
                  link.click();
                }}
                className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition gap-2"
              >
                <FileText className="w-6 h-6 text-blue-700 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Word</span>
              </button>

              <button
                onClick={async () => {
                  const { exportToPPT } = await import("../utils/converters");
                  const blob = await exportToPPT(images);
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${fileName}.pptx`;
                  link.click();
                }}
                className="flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/40 transition gap-2"
              >
                <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-medium text-orange-700 dark:text-orange-400">PowerPoint</span>
              </button>

              <button
                onClick={async () => {
                  if (!scannedText) {
                    alert("No text detected for Excel export. Please ensure the document has readable text.");
                    return;
                  }
                  const { exportToExcel } = await import("../utils/converters");
                  const blob = exportToExcel(scannedText);
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${fileName}.xlsx`;
                  link.click();
                }}
                className="flex flex-col items-center justify-center bg-green-50 dark:bg-green-900/20 p-3 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/40 transition gap-2"
              >
                <FileText className="w-6 h-6 text-green-700 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">Excel</span>
              </button>
            </div>

            <div className="h-4" /> {/* Spacer */}

            <ActionButton
              icon={<Printer className="text-purple-600 dark:text-purple-400" />}
              title="Print Document"
              desc="Send to printer"
              onClick={handlePrint}
            />

            <ActionButton
              icon={<Edit2 className="text-orange-600 dark:text-orange-400" />}
              title="Edit Scans"
              desc="Adjust images again"
              onClick={onEdit}
            />
          </div>
        </div>
      </div>

      {/* DONE */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-5 py-4">
        <button
          onClick={onComplete}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          Done
        </button>
      </div>


    </div>
  );
}

/* REUSABLE ACTION BUTTON */
function ActionButton({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
    >
      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div className="text-left">
        <p className="font-semibold text-sm text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
    </button>
  );
}
