import { useState, useEffect } from "react";
import { SplashScreen } from "./components/SplashScreen";
import { ViewDocumentScreen } from "./components/ViewDocumentScreen";
import { generatePDF, mergePDFs } from "./utils/pdfGenerator";
import { OnboardingScreens } from "./components/OnboardingScreens";
import { HomeScreen } from "./components/HomeScreen";
import { CameraScanScreen } from "./components/CameraScanScreen";
import { EditDocumentScreen } from "./components/EditDocumentScreen";
import { PDFPreviewScreen } from "./components/PDFPreviewScreen";
import { SaveShareScreen } from "./components/SaveShareScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { MergeScreen } from "./components/MergeScreen";
import { QRScannerScreen } from "./components/QRScannerScreen";
import { QRGeneratorScreen } from "./components/QRGeneratorScreen";
import { LoginScreen } from "./components/LoginScreen";
import { AuthProvider } from "./contexts/AuthProvider";
import { PdfEditor } from "../components/PdfEditor/PdfEditor";
import { useAuth } from "./hooks/useAuth";
import { ScannedDoc, EditedPdf } from "./types/types";
import { recognizeText } from "./utils/ocr";
import localforage from "localforage";

export type Screen =
  | "splash"
  | "login"
  | "onboarding"
  | "home"
  | "camera"
  | "edit"
  | "pdf-preview"
  | "save-share"
  | "settings"
  | "view-doc"
  | "merge"
  | "qr-scan"
  | "qr-gen"
  | "pdf-editor";



export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>("splash");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("isDarkMode");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("isDarkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  /* SCANNED DOCUMENTS */
  const [scannedDocs, setScannedDocs] = useState<ScannedDoc[]>(() => {
    try {
      const saved = localStorage.getItem("scannedDocs");
      if (!saved) return [];

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      // Migrate old data (image: string) to new format (pages: string[])
      return parsed.map((doc: any) => {
        if (doc.pages) return doc; // Already new format
        if (doc.image) {
          return {
            ...doc,
            pages: [doc.image], // Convert single image to array
            // Remove legacy image prop if you want, or keep it irrelevant
          };
        }
        return doc;
      });
    } catch (e) {
      console.error("Failed to parse scanned docs", e);
      return [];
    }
  });
  const [activePages, setActivePages] = useState<string[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<ScannedDoc | null>(null);
  const [editStartIndex, setEditStartIndex] = useState(0);
  const [returnScreen, setReturnScreen] = useState<Screen>("home");
  const [saveShareReturnScreen, setSaveShareReturnScreen] = useState<Screen>("pdf-preview");

  /* PERSISTENCE */
  useEffect(() => {
    localStorage.setItem("scannedDocs", JSON.stringify(scannedDocs));
  }, [scannedDocs]);

  /* EDITED PDFS (Via LocalForage due to size) */
  const [editedPdfs, setEditedPdfs] = useState<EditedPdf[]>([]);

  useEffect(() => {
    // Load initially
    localforage.getItem<EditedPdf[]>("editedPdfs").then((data) => {
      if (data) setEditedPdfs(data);
    }).catch(err => console.error("Failed to load edited PDFs", err));
  }, []);

  useEffect(() => {
    // Save on change
    if (editedPdfs.length > 0) {
      localforage.setItem("editedPdfs", editedPdfs).catch(err => console.error("Failed to save edited PDFs", err));
    }
  }, [editedPdfs]);

  /* PDF OUTPUT */
  const [pdfUrl, setPdfUrl] = useState("");
  const [fileName, setFileName] = useState("");

  /* PDF EDITOR STATE */
  const [pdfEditorInitialFile, setPdfEditorInitialFile] = useState<File | null>(null);

  /* SPLASH AUTO TRANSITION */
  useEffect(() => {
    if (currentScreen !== "splash") return;
    const timer = setTimeout(() => {
      // After splash, check if user is authenticated
      if (loading) return; // Wait for auth to load
      setCurrentScreen("home");
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentScreen, user, loading]);

  /* HANDLE NEW SCAN */
  const handleNewScan = (images: string[]) => {
    // If we are already editing a doc (Add Page mode), append
    if (activeDocId) {
      setScannedDocs(prev => prev.map(d => {
        if (d.id === activeDocId) {
          const updatedPages = [...d.pages, ...images];
          setActivePages(updatedPages); // Update local state
          return { ...d, pages: updatedPages };
        }
        return d;
      }));
    } else {
      // New Scan
      const newId = crypto.randomUUID();
      setActivePages(images);
      setActiveDocId(newId);

      // Create preliminary doc
      setScannedDocs(prev => [
        {
          id: newId,
          pages: images,
          date: new Date().toLocaleString(),
        },
        ...prev,
      ]);
    }
  };

  // Show loading spinner while checking auth
  if (loading && currentScreen === "splash") {
    return (
      <div className={`${isDarkMode ? "dark bg-gray-900" : "bg-gray-50"} min-h-screen`}>
        <div className="max-w-[360px] mx-auto min-h-screen bg-white dark:bg-gray-900 shadow-2xl relative overflow-hidden">
          <SplashScreen onComplete={() => { }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDarkMode ? "dark bg-gray-900" : "bg-gray-50"} min-h-screen`}>
      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto min-h-screen bg-white dark:bg-gray-900 shadow-2xl relative overflow-hidden flex flex-col">

        {currentScreen === "splash" && (
          <SplashScreen onComplete={() => setCurrentScreen("home")} />
        )}

        {currentScreen === "login" && (
          <LoginScreen />
        )}

        {currentScreen === "onboarding" && (
          <OnboardingScreens onComplete={() => setCurrentScreen("home")} />
        )}

        {currentScreen === "home" && (
          <HomeScreen
            onNavigate={setCurrentScreen}
            onScan={() => {
              setActiveDocId(null);
              setActivePages([]);
              setCurrentScreen("camera");
            }}
            onView={(doc) => {
              setSelectedDoc(doc);
              setActivePages(doc.pages);
              setActiveDocId(doc.id);
              setReturnScreen("home");
              setCurrentScreen("pdf-preview");
            }}
            onDelete={(id) => {
              if (confirm("Are you sure you want to delete this scan?")) {
                setScannedDocs(prev => prev.filter(d => d.id !== id));
              }
            }}
            onImportImages={(images) => {
              // Same as New Scan, but direct from Home
              handleNewScan(images);
              setEditStartIndex(0);
              setCurrentScreen("edit");
            }}
            scannedDocs={scannedDocs}
            onUpdateDoc={(id, updates) => {
              setScannedDocs(prev => prev.map(d =>
                d.id === id ? { ...d, ...updates } : d
              ));
            }}
            onOpenPdfEditor={(file) => {
              if (file) {
                setPdfEditorInitialFile(file);
              } else {
                setPdfEditorInitialFile(null);
              }
              setCurrentScreen("pdf-editor");
            }}
          />
        )}

        {currentScreen === "camera" && (
          <CameraScanScreen
            onBack={() => setCurrentScreen("home")}
            onCapture={(imgs) => {
              handleNewScan(imgs);
              setEditStartIndex(0);
              setCurrentScreen("edit");
            }}
          />
        )}

        {currentScreen === "edit" && activePages.length > 0 && (
          <EditDocumentScreen
            pages={activePages}
            initialPage={editStartIndex}
            onBack={() => setCurrentScreen("camera")}
            onAddPage={(currentPages) => {
              // Save state and go back to camera to add more
              if (activeDocId) {
                setScannedDocs(prev => prev.map(d =>
                  d.id === activeDocId ? { ...d, pages: currentPages } : d
                ));
              }
              setActivePages(currentPages);
              setCurrentScreen("camera");
            }}
            onNext={(editedPages) => {
              // Update the active document with edited images
              if (activeDocId) {
                setScannedDocs(prev => prev.map(d =>
                  d.id === activeDocId ? { ...d, pages: editedPages } : d
                ));
                // Update active pages for preview
                setActivePages(editedPages);

                // Set as selected for viewing (background update)
                const updatedDoc = scannedDocs.find(d => d.id === activeDocId);
                if (updatedDoc) {
                  setSelectedDoc({ ...updatedDoc, pages: editedPages });
                }

                // Go to PDF Preview
                setReturnScreen("edit");
                setCurrentScreen("pdf-preview");
              } else {
                // Should not happen, but fallback
                setCurrentScreen("home");
              }
            }}
          />
        )}

        {currentScreen === "pdf-preview" && activePages.length > 0 && (
          <PDFPreviewScreen
            images={activePages}
            initialFileName={scannedDocs.find(d => d.id === activeDocId)?.name}
            onBack={() => setCurrentScreen(returnScreen)}
            onAddPage={(currentPages) => {
              // Same logic as Edit Screen: go back to camera to append
              setActivePages(currentPages);
              setCurrentScreen("camera");
            }}
            onEditPage={(index) => {
              setEditStartIndex(index);
              setCurrentScreen("edit");
            }}
            onAdvancedEdit={async (name, images, password) => {
              // Convert scanned pages to a temporary PDF, then open in Editor
              setActivePages(images);
              if (activeDocId) {
                setScannedDocs(prev => prev.map(d =>
                  d.id === activeDocId ? { ...d, pages: images, name } : d
                ));
              }

              const url = await generatePDF(images, password);
              const response = await fetch(url);
              const blob = await response.blob();
              const finalFileName = name ? `${name}.pdf` : `Scan_${new Date().toLocaleString().replace(/[/:\\s,]/g, '_')}.pdf`;
              const file = new File([blob], finalFileName, { type: 'application/pdf' });

              setPdfEditorInitialFile(file);
              setReturnScreen("pdf-preview");
              setCurrentScreen("pdf-editor");
            }}
            onSave={async (name, images, password) => {
              // SYNCHRONIZE STATE: Update active pages and stored doc to reflect any deletions
              setActivePages(images);
              if (activeDocId) {
                setScannedDocs(prev => prev.map(d =>
                  d.id === activeDocId ? { ...d, pages: images, name } : d
                ));
              }

              const url = await generatePDF(images, password);
              setPdfUrl(url);
              setFileName(name);
              setSaveShareReturnScreen("pdf-preview");
              setCurrentScreen("save-share");

              // TRIGGER BACKGROUND OCR AND CLASSIFICATION
              if (activeDocId) {
                import("./utils/classify").then(({ classifyDocument }) => { // Lazy load
                  // We don't await this so UI stays responsive
                  recognizeText(images).then(text => {
                    if (!text) return;
                    const category = classifyDocument(text);
                    setScannedDocs(prev => prev.map(d =>
                      d.id === activeDocId ? { ...d, text, category } : d
                    ));
                  });
                });
              }
            }}
          />
        )}

        {currentScreen === "save-share" && (
          <SaveShareScreen
            pdfUrl={pdfUrl}
            fileName={fileName}
            images={activePages}
            scannedText={scannedDocs.find(d => d.id === activeDocId)?.text}
            onBack={() => setCurrentScreen(saveShareReturnScreen)}
            onComplete={() => setCurrentScreen("home")}
            onEdit={() => setCurrentScreen("edit")}
          />
        )}

        {currentScreen === "settings" && (
          <SettingsScreen
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode((v: boolean) => !v)}
            onBack={() => setCurrentScreen("home")}
            onMergePdf={() => setCurrentScreen("merge")}
          />
        )}

        {currentScreen === "merge" && (
          <MergeScreen
            scannedDocs={scannedDocs}
            onBack={() => setCurrentScreen("settings")}
            onMerge={async (docs, name) => {
              // Show loading state if needed, or just await
              try {
                const url = await mergePDFs(docs);
                setPdfUrl(url);
                setFileName(name);

                // If all docs are internal ScannedDocs (not Files), save to recent list
                const isAllInternal = docs.every(d => !(d instanceof File));
                if (isAllInternal) {
                  const internalDocs = docs as ScannedDoc[];
                  const allPages = internalDocs.flatMap(d => d.pages);

                  const newMergedDoc: ScannedDoc = {
                    id: crypto.randomUUID(),
                    pages: allPages,
                    date: new Date().toLocaleString(),
                  };

                  setScannedDocs(prev => [newMergedDoc, ...prev]);
                } else {
                  // Optional: Notify user that hybrid/external merges aren't saved to history
                  // alert("Note: Merges involving external files are not saved to 'Recent Scans' history.");
                }

                setSaveShareReturnScreen("home");
                setCurrentScreen("save-share");
              } catch (e) {
                console.error("Merge failed", e);
                alert("Failed to merge documents.");
              }
            }}
          />
        )}

        {currentScreen === "qr-scan" && (
          <QRScannerScreen onBack={() => setCurrentScreen("home")} />
        )}

        {currentScreen === "qr-gen" && (
          <QRGeneratorScreen onBack={() => setCurrentScreen("home")} />
        )}

        {currentScreen === "view-doc" && selectedDoc && (
          <ViewDocumentScreen
            doc={selectedDoc}
            onBack={() => setCurrentScreen("home")}
            onDelete={(id) => {
              if (confirm("Are you sure you want to delete this scan?")) {
                setScannedDocs(prev => prev.filter(d => d.id !== id));
                setCurrentScreen("home");
              }
            }}
            onEdit={(doc) => {
              setActivePages(doc.pages);
              setActiveDocId(doc.id);
              setCurrentScreen("edit");
            }}
            onEditPage={(doc, index) => {
              setActivePages(doc.pages);
              setActiveDocId(doc.id);
              setEditStartIndex(index);
              setCurrentScreen("edit");
            }}
            onAdvancedEdit={async (doc) => {
              // Convert scanned pages to a temporary PDF, then open in Editor
              setActivePages(doc.pages);
              setActiveDocId(doc.id);

              const url = await generatePDF(doc.pages);
              const response = await fetch(url);
              const blob = await response.blob();
              const fileName = doc.name ? `${doc.name}.pdf` : `Scan_${doc.date.replace(/[/:\\s,]/g, '_')}.pdf`;
              const file = new File([blob], fileName, { type: 'application/pdf' });

              setPdfEditorInitialFile(file);
              setCurrentScreen("pdf-editor");
            }}
            onShare={async (doc) => {
              // Generate PDF for this single doc and go to save screen
              setActivePages(doc.pages);
              const url = await generatePDF(doc.pages);
              setPdfUrl(url);
              setFileName(`Scan_${doc.date.replace(/[/:\\s,]/g, '_')}`);
              setSaveShareReturnScreen("home");
              setCurrentScreen("save-share");
            }}
          />
        )}

        {currentScreen === "pdf-editor" && (
          <PdfEditor
            initialFile={pdfEditorInitialFile || undefined}
            onClose={() => {
              setPdfEditorInitialFile(null);
              setCurrentScreen("home");
            }}
            onSave={async (pdfBytes, fileName) => {
              // The user saved a PDF from the editor.
              // Generate a Blob URL to show in SaveShareScreen
              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              setPdfUrl(url);
              setFileName(fileName);

              // Convert to Base64 to store in localforage
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64data = reader.result as string;

                const newEditedPdf: EditedPdf = {
                  id: crypto.randomUUID(),
                  name: fileName,
                  pdfBase64: base64data,
                  date: new Date().toLocaleString(),
                  sizeMB: (blob.size / (1024 * 1024)).toFixed(2) + " MB"
                };

                setEditedPdfs(prev => [newEditedPdf, ...prev]);
              };
              reader.readAsDataURL(blob);

              setPdfEditorInitialFile(null);
              setSaveShareReturnScreen("home");
              setCurrentScreen("save-share");
            }}
          />
        )}

      </div>
    </div>
  );
}
