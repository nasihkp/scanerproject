export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
}

export interface GoogleDriveServiceType {
  initialize: () => Promise<void>;
  uploadFile: (file: Blob, fileName: string, mimeType: string) => Promise<DriveDocument>;
  listFiles: () => Promise<DriveDocument[]>;
  deleteFile: (fileId: string) => Promise<void>;
  downloadFile: (fileId: string) => Promise<Blob>;
  createFolder: (folderName: string, parentId?: string) => Promise<string>;
  findOrCreateAppFolder: () => Promise<string>;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface ScannedDoc {
  id: string;
  pages: string[];
  date: string;
  text?: string; // OCR content
  driveId?: string; // Google Drive File ID
  name?: string;
  category?: string; // AI Classification
}

export interface EditedPdf {
  id: string;
  name: string;
  pdfBase64: string;
  date: string;
  sizeMB: string;
}
