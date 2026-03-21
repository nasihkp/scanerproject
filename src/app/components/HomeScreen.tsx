import {
  Plus,
  Settings,
  Image as ImageIcon,
  Trash2,
  Search,
  Cloud,
  RefreshCw,
  UploadCloud,
  FileText,
  QrCode,
  ScanLine,
  LogOut,
  User,
  Camera,
  Clock
} from "lucide-react";
import React, { useRef, useState, useEffect } from "react";
import type { Screen } from "../App";
import { useAuth } from "../hooks/useAuth";
import { useGoogleDrive } from "../hooks/useGoogleDrive";

import { ScannedDoc, EditedPdf } from "../types/types";
import { generatePDF } from "../utils/pdfGenerator";

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  onScan: () => void;
  onView: (doc: ScannedDoc) => void;
  onDelete: (id: string) => void;
  onImportImages: (images: string[]) => void;
  scannedDocs: ScannedDoc[];
  onUpdateDoc: (id: string, updates: Partial<ScannedDoc>) => void; // New prop to update local doc with driveId
  onOpenPdfEditor: (file?: File) => void;
  editedPdfs: EditedPdf[];
  onOpenEditedPdf: (pdf: EditedPdf) => void;
  onDeleteEditedPdf: (id: string) => void;
}

export function HomeScreen({
  onNavigate,
  onScan,
  onView,
  onDelete,
  onImportImages,
  scannedDocs,
  onUpdateDoc,
  onOpenPdfEditor,
  editedPdfs,
  onOpenEditedPdf,
  onDeleteEditedPdf
}: HomeScreenProps) {
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [viewMode, setViewMode] = useState<"local" | "cloud" | "edited">("local");
  const [showPdfOptions, setShowPdfOptions] = useState(false);

  // Drive Hook
  const {
    documents: driveDocs,
    loading: driveLoading,
    fetchDocuments,
    uploadDocument,
    deleteDocument
  } = useGoogleDrive();

  // Initial fetch when switching to cloud mode or user logs in
  useEffect(() => {
    if (user && viewMode === "cloud") {
      fetchDocuments();
    }
  }, [user, viewMode]);

  const [syncingDocs, setSyncingDocs] = useState<Set<string>>(new Set());

  const handleUpload = async (e: React.MouseEvent, doc: ScannedDoc) => {
    e.stopPropagation();
    if (!doc.pages[0]) return;

    setSyncingDocs(prev => new Set(prev).add(doc.id));

    try {
      // 1. Generate PDF Blob
      const pdfUrl = await generatePDF(doc.pages);
      const response = await fetch(pdfUrl);
      const blob = await response.blob();

      // 2. Upload to Drive
      const fileName = `Scan_${doc.date.replace(/[\/:\s,]/g, '_')}.pdf`;
      const result = await uploadDocument(blob, fileName);

      if (result) {
        // 3. Update local doc with driveId
        onUpdateDoc(doc.id, { driveId: result.id });
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload document.");
    } finally {
      setSyncingDocs(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const filteredLocalDocs = scannedDocs.filter(doc => {
    const query = searchQuery.toLowerCase();
    const dateMatch = doc.date.toLowerCase().includes(query);
    const textMatch = doc.text?.toLowerCase().includes(query);
    return dateMatch || textMatch;
  });

  const filteredCloudDocs = driveDocs.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEditedPdfs = editedPdfs.filter(pdf =>
    pdf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pdf.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  let displayDocs: any[] = [];
  if (viewMode === "local") displayDocs = filteredLocalDocs;
  else if (viewMode === "cloud") displayDocs = filteredCloudDocs;
  else if (viewMode === "edited") displayDocs = filteredEditedPdfs;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const images: string[] = [];
    let processed = 0;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === "string") {
          images.push(result);
        }
        processed++;
        if (processed === fileArray.length) {
          onImportImages(images);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenPdfEditor(file); // Pass the File object to parent (App.tsx)
    }
    setShowPdfOptions(false);
    e.target.value = '';
  };

  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      await signOut();
    }
  };

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      <input
        type="file"
        multiple
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        type="file"
        accept="application/pdf"
        ref={pdfInputRef}
        className="hidden"
        onChange={handlePdfSelect}
      />

      {/* User Profile Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">SmartScan</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('qr-scan')}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
              title="Scan QR Code"
            >
              <ScanLine className="w-5 h-5" />
            </button>
            <button
              onClick={() => onNavigate('qr-gen')}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
              title="Generate QR Code"
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            {user && (
              <button
                onClick={handleSignOut}
                className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
              </button>
            )}
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-700 shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {user.displayName || "User"}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {user.email}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Scan button */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <button
            onClick={onScan}
            className="flex-1 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl transition"
          >
            <Camera className="w-8 h-8" />
            <span className="text-lg font-semibold">Scan</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition"
          >
            <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold">Import</span>
          </button>

          <button
            onClick={() => setShowPdfOptions(true)}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition relative"
          >
            <FileText className="w-8 h-8 text-[#3b82f6]" />
            <span className="text-lg font-semibold">PDF Editor</span>
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="mb-6 relative">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* VIEW TABS */}
        <div className="flex items-center gap-4 mb-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setViewMode("local")}
            className={`pb - 2 px - 1 font - medium text - sm transition ${viewMode === "local" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"} `}
          >
            Local Scans
          </button>
          <button
            onClick={() => setViewMode("cloud")}
            className={`pb-2 px-1 font-medium text-sm transition ${viewMode === "cloud" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
          >
            Google Drive
          </button>
          <button
            onClick={() => setViewMode("edited")}
            className={`pb-2 px-1 font-medium text-sm transition ${viewMode === "edited" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
          >
            Edited PDFs
          </button>
        </div>

        {/* Content List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {viewMode === "local" ? (
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              ) : viewMode === "cloud" ? (
                <Cloud className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              )}
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">
                {viewMode === "local" ? "Recent Scans" : viewMode === "cloud" ? "Cloud Documents" : "Edited PDFs"}
              </h2>
            </div>
            {viewMode === "cloud" && (
              <button
                onClick={fetchDocuments}
                className={`p - 1 rounded - full hover: bg - gray - 100 dark: hover: bg - gray - 800 transition ${driveLoading ? "animate-spin" : ""} `}
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {/* EMPTY STATE */}
          {displayDocs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center text-gray-500 dark:text-gray-400">
              {viewMode === "local" ? "No local scans found." : viewMode === "cloud" ? (driveLoading ? "Loading..." : "No documents in Drive folder.") : "No edited PDFs found."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* @ts-ignore - separate types but similar enough structure for list */}
              {displayDocs.map((doc: any) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (viewMode === "local") {
                      onView(doc);
                    } else if (viewMode === "cloud") {
                      // Open Google Drive viewer
                      if (doc.webViewLink) {
                        window.open(doc.webViewLink, "_blank");
                      } else {
                        alert("Cannot open this document.");
                      }
                    } else if (viewMode === "edited") {
                      onOpenEditedPdf(doc as unknown as EditedPdf);
                    }
                  }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 flex flex-col gap-3 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition cursor-pointer active:scale-98 relative group"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900 border dark:border-gray-600 flex items-center justify-center">
                    {/* Thumbnail: Real image for local, Icon for cloud/edited */}
                    {viewMode === "local" ? (
                      <img
                        src={doc.pages[0]}
                        alt="Scanned"
                        className="w-full h-full object-cover"
                      />
                    ) : viewMode === "cloud" ? (
                      doc.thumbnailLink ? (
                        <img src={doc.thumbnailLink} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <FileText className="w-12 h-12 text-gray-300" />
                      )
                    ) : (
                      // Edited PDF thumbnail placeholder
                      <div className="w-full h-full bg-blue-50 dark:bg-blue-900/20 flex flex-col items-center justify-center gap-2">
                        <FileText className="w-12 h-12 text-blue-500" />
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{doc.sizeMB}</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this document?")) {
                            if (viewMode === "local") {
                              onDelete(doc.id);
                            } else if (viewMode === "cloud") {
                              const success = await deleteDocument(doc.id);
                              if (!success) alert("Failed to delete from Drive.");
                            } else if (viewMode === "edited") {
                              onDeleteEditedPdf(doc.id);
                            }
                          }
                        }}
                        className="p-2 text-white hover:text-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      {/* Sync/Upload Status Icon */}
                      {viewMode === "local" ? (
                        <div title={doc.driveId ? "Synced to Drive" : "Upload to Drive"}>
                          {syncingDocs.has(doc.id) ? (
                            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                          ) : doc.driveId ? (
                            <Cloud className="w-5 h-5 text-green-400" />
                          ) : (
                            <button
                              onClick={(e) => handleUpload(e, doc)}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition"
                            >
                              <UploadCloud className="w-5 h-5 text-white" />
                            </button>
                          )}
                        </div>
                      ) : viewMode === "cloud" ? (
                        /* Cloud View: Show external link icon */
                        <div title="Open in Google Drive">
                          <Cloud className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        /* Edited PDF View */
                        <div title="Open PDF">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                      {viewMode === "local" ? (doc.name || (doc.pages.length > 1 ? `${doc.pages.length} Pages` : "Scanned Document")) : doc.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {viewMode === "cloud" ? new Date(doc.createdTime).toLocaleDateString() : doc.date}
                      </p>
                      {doc.category && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded">
                          {doc.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating scan button */}
      <button
        onClick={onScan}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition"
      >
        <Plus className="w-7 h-7" />
      </button>
      {/* PDF Options Modal */}
      {showPdfOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">PDF Editor</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Would you like to start a new blank document or edit an existing PDF from your device?</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowPdfOptions(false);
                  onNavigate('pdf-editor');
                }}
                className="w-full bg-[#3b82f6] hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition"
              >
                Create Blank PDF
              </button>
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 rounded-xl transition"
              >
                Open Local PDF
              </button>
              <button
                onClick={() => setShowPdfOptions(false)}
                className="w-full bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium py-3 rounded-xl transition mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
