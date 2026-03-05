import { useState, useRef } from "react";
import { googleDriveService } from "../services/googleDrive.service";
import { DriveDocument } from "../types/types";
import { useAuth } from "./useAuth";

export function useGoogleDrive() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const initializedRef = useRef(false);

  /* ================================
     ENSURE DRIVE IS INITIALIZED
     ================================ */
  const ensureInitialized = async () => {
    if (!user) throw new Error("User not authenticated");

    if (initializedRef.current) return;

    // Get the stored Google Access Token
    const token = localStorage.getItem("google_access_token");

    if (!token) {
      throw new Error("Local Google Token missing. Please 'Reconnect Google Drive'.");
    }

    googleDriveService.initialize(token);
    initializedRef.current = true;
  };

  /* ================================
     FETCH DOCUMENTS
     ================================ */
  const fetchDocuments = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await ensureInitialized();
      const files = await googleDriveService.listFiles();
      setDocuments(files);
    } catch (err: any) {
      console.error("Error fetching documents:", err);
      setError(err.message || "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  /* ================================
     UPLOAD DOCUMENT
     ================================ */
  const uploadDocument = async (
    file: Blob,
    fileName: string,
    mimeType = "application/pdf"
  ): Promise<DriveDocument | null> => {
    if (!user) {
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    let progressTimer: number | undefined;

    try {
      await ensureInitialized();

      progressTimer = window.setInterval(() => {
        setUploadProgress((p) => Math.min(p + 10, 90));
      }, 200);

      const doc = await googleDriveService.uploadFile(
        file,
        fileName,
        mimeType
      );

      clearInterval(progressTimer);
      setUploadProgress(100);

      await fetchDocuments();
      setTimeout(() => setUploadProgress(0), 800);

      return doc;
    } catch (err: any) {
      if (progressTimer) clearInterval(progressTimer);
      console.error("Error uploading document:", err);
      setError(err.message || "Failed to upload document");
      setUploadProgress(0);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /* ================================
     DELETE DOCUMENT
     ================================ */
  const deleteDocument = async (fileId: string): Promise<boolean> => {
    if (!user) {
      setError("User not authenticated");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await ensureInitialized();
      await googleDriveService.deleteFile(fileId);
      await fetchDocuments();
      return true;
    } catch (err: any) {
      console.error("Error deleting document:", err);
      setError(err.message || "Failed to delete document");
      return false;
    } finally {
      setLoading(false);
    }
  };

  /* ================================
     DOWNLOAD DOCUMENT
     ================================ */
  const downloadDocument = async (fileId: string): Promise<Blob | null> => {
    if (!user) {
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      await ensureInitialized();
      return await googleDriveService.downloadFile(fileId);
    } catch (err: any) {
      console.error("Error downloading document:", err);
      setError(err.message || "Failed to download document");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    documents,
    loading,
    error,
    uploadProgress,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    downloadDocument,
  };
}
