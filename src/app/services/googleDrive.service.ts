import { DriveDocument } from "../types/types";

class GoogleDriveService {
    private accessToken: string | null = null;
    private appFolderId: string | null = null;
    private readonly APP_FOLDER_NAME = "ScannerApp";

    /* ================================
       INITIALIZE WITH FIREBASE TOKEN
       ================================ */
    initialize(token: string) {
        if (!token) {
            throw new Error("Google access token missing");
        }
        this.accessToken = token;
    }

    /* ================================
       INTERNAL REQUEST HELPER
       ================================ */
    private async request<T>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> {
        if (!this.accessToken) {
            throw new Error("Authentication required");
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "Google Drive request failed");
        }

        // DELETE requests return empty body
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    /* ================================
       FIND OR CREATE APP FOLDER
       ================================ */
    async findOrCreateAppFolder(): Promise<string> {
        if (this.appFolderId) return this.appFolderId;

        const search = await this.request<any>(
            `https://www.googleapis.com/drive/v3/files?q=name='${this.APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
        );

        if (search.files && search.files.length > 0) {
            this.appFolderId = search.files[0].id;
            if (this.appFolderId) return this.appFolderId;
        }

        const created = await this.request<any>(
            "https://www.googleapis.com/drive/v3/files",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: this.APP_FOLDER_NAME,
                    mimeType: "application/vnd.google-apps.folder",
                }),
            }
        );

        this.appFolderId = created.id;
        if (!this.appFolderId) throw new Error("Failed to create app folder");
        return this.appFolderId;
    }

    /* ================================
       UPLOAD OR UPDATE FILE
       ================================ */
    async uploadFile(
        file: Blob,
        fileName: string,
        mimeType: string
    ): Promise<DriveDocument> {
        const folderId = await this.findOrCreateAppFolder();

        // 1. Check if file with same name exists
        const search = await this.request<any>(
            `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,webViewLink,createdTime,modifiedTime,size)`
        );

        const existingFile = search.files && search.files.length > 0 ? search.files[0] : null;

        if (existingFile) {
            console.log("File exists, updating...", existingFile.id);
            // 2. Update existing file content
            return await this.updateFileContent(existingFile.id, file, mimeType);
        }

        // 3. Create new file if not found
        console.log("Creating new file...", fileName);
        const metadata = {
            name: fileName,
            mimeType: mimeType,
            parents: [folderId],
        };

        const formData = new FormData();
        formData.append(
            "metadata",
            new Blob([JSON.stringify(metadata)], {
                type: "application/json",
            })
        );
        formData.append("file", file, fileName);

        return await this.request<DriveDocument>(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime,modifiedTime,size",
            {
                method: "POST",
                body: formData,
            }
        );
    }

    /* ================================
       UPDATE EXISTING FILE CONTENT
       ================================ */
    private async updateFileContent(
        fileId: string,
        file: Blob,
        mimeType: string
    ): Promise<DriveDocument> {
        // For updates, we use PATCH to upload/drive/v3/files/fileId

        // Minimal metadata update if needed (e.g. mimeType), mostly content
        const metadata = {
            mimeType: mimeType,
        };

        const formData = new FormData();
        formData.append(
            "metadata",
            new Blob([JSON.stringify(metadata)], {
                type: "application/json",
            })
        );
        formData.append("file", file);

        return await this.request<DriveDocument>(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime,modifiedTime,size`,
            {
                method: "PATCH",
                body: formData,
            }
        );
    }

    /* ================================
       LIST FILES
       ================================ */
    async listFiles(): Promise<DriveDocument[]> {
        const folderId = await this.findOrCreateAppFolder();

        const response = await this.request<any>(
            `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,webViewLink,createdTime,modifiedTime,size)&orderBy=modifiedTime desc`
        );

        return response.files || [];
    }

    /* ================================
       DELETE FILE
       ================================ */
    async deleteFile(fileId: string): Promise<void> {
        await this.request(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            { method: "DELETE" }
        );
    }

    /* ================================
       DOWNLOAD FILE
       ================================ */
    async downloadFile(fileId: string): Promise<Blob> {
        if (!this.accessToken) {
            throw new Error("Authentication required");
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error("Failed to download file");
        }

        return response.blob();
    }
}

/* ================================
   SINGLETON EXPORT
   ================================ */
export const googleDriveService = new GoogleDriveService();
