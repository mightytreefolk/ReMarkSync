import { App, normalizePath } from 'obsidian';
import { RemarkableParser } from './parser';
import { ExcalidrawConverter, ConversionOptions } from './converter';
import { RemarkableSyncSettings } from './settings';
import * as fs from 'fs';
import * as path from 'path';

export interface RemarkableDocument {
    uuid: string;
    visibleName: string;
    type: 'DocumentType' | 'CollectionType';
    parent: string;
    lastModified: number;
    isPdf: boolean;
    pdfPath?: string;  // Path to the PDF file if this is a PDF annotation
    pages: RemarkablePage[];
}

export interface RemarkablePage {
    id: string;
    rmPath: string;
}

export interface SyncResult {
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
}

export class SyncManager {
    private app: App;
    private settings: RemarkableSyncSettings;

    constructor(app: App, settings: RemarkableSyncSettings) {
        this.app = app;
        this.settings = settings;
    }

    updateSettings(settings: RemarkableSyncSettings) {
        this.settings = settings;
    }

    /**
     * Get the effective ReMarkable path (auto-detect if not set)
     */
    getRemarkablePath(): string | null {
        if (this.settings.remarkablePath) {
            return this.settings.remarkablePath;
        }

        // Try to auto-detect on macOS
        const homeDir = process.env.HOME || '';
        const possiblePaths = [
            path.join(homeDir, 'Library/Containers/com.remarkable.desktop/Data/Library/Application Support/remarkable/desktop'),
            path.join(homeDir, 'Library/Application Support/remarkable/desktop'),
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return null;
    }

    /**
     * Discover all documents in the reMarkable folder
     */
    discoverDocuments(): RemarkableDocument[] {
        const remarkablePath = this.getRemarkablePath();
        if (!remarkablePath) {
            throw new Error('reMarkable data folder not found. Please set it in settings.');
        }

        const documents: RemarkableDocument[] = [];
        const entries = fs.readdirSync(remarkablePath);

        // Find all .metadata files
        const metadataFiles = entries.filter(e => e.endsWith('.metadata'));

        for (const metaFile of metadataFiles) {
            const uuid = metaFile.replace('.metadata', '');
            const metaPath = path.join(remarkablePath, metaFile);

            try {
                const metaContent = fs.readFileSync(metaPath, 'utf8');
                const meta = JSON.parse(metaContent);

                // Skip folders (CollectionType)
                if (meta.type === 'CollectionType') continue;

                // Skip trashed items
                if (meta.parent === 'trash') continue;

                // Check if this is a PDF
                const pdfPath = path.join(remarkablePath, `${uuid}.pdf`);
                const isPdf = fs.existsSync(pdfPath);

                // Get pages from .content file
                const contentPath = path.join(remarkablePath, `${uuid}.content`);
                const pages: RemarkablePage[] = [];

                if (fs.existsSync(contentPath)) {
                    const contentData = fs.readFileSync(contentPath, 'utf8');
                    const content = JSON.parse(contentData);

                    // Extract page IDs
                    if (content.cPages?.pages) {
                        for (const page of content.cPages.pages) {
                            const rmPath = path.join(remarkablePath, uuid, `${page.id}.rm`);
                            if (fs.existsSync(rmPath)) {
                                pages.push({ id: page.id, rmPath });
                            }
                        }
                    }
                }

                // If no pages found via content, try to find .rm files directly
                if (pages.length === 0) {
                    const docFolder = path.join(remarkablePath, uuid);
                    if (fs.existsSync(docFolder) && fs.statSync(docFolder).isDirectory()) {
                        const rmFiles = fs.readdirSync(docFolder).filter(f => f.endsWith('.rm'));
                        for (const rmFile of rmFiles) {
                            pages.push({
                                id: rmFile.replace('.rm', ''),
                                rmPath: path.join(docFolder, rmFile)
                            });
                        }
                    }
                }

                documents.push({
                    uuid,
                    visibleName: meta.visibleName || uuid,
                    type: meta.type,
                    parent: meta.parent || '',
                    lastModified: parseInt(meta.lastModified) || 0,
                    isPdf,
                    pdfPath: isPdf ? pdfPath : undefined,
                    pages
                });
            } catch {
                // Skip documents with invalid metadata
            }
        }

        return documents;
    }

    /**
     * Build folder path for a document based on reMarkable folder hierarchy
     */
    buildFolderPath(doc: RemarkableDocument, _allDocs: RemarkableDocument[]): string {
        const parts: string[] = [];
        let currentParent = doc.parent;

        // Build path by traversing parent folders
        const remarkablePath = this.getRemarkablePath();
        if (!remarkablePath) return this.settings.syncFolder;

        while (currentParent) {
            const parentMetaPath = path.join(remarkablePath, `${currentParent}.metadata`);
            if (fs.existsSync(parentMetaPath)) {
                try {
                    const parentMeta = JSON.parse(fs.readFileSync(parentMetaPath, 'utf8'));
                    parts.unshift(this.sanitizeName(parentMeta.visibleName || currentParent));
                    currentParent = parentMeta.parent || '';
                } catch {
                    break;
                }
            } else {
                break;
            }
        }

        parts.unshift(this.settings.syncFolder);
        return parts.join('/');
    }

    /**
     * Sanitize a name for use as a file/folder name
     */
    sanitizeName(name: string): string {
        return name
            .replace(/[\\/:*?"<>|]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Run a full sync
     * @param progressCallback - Optional callback for progress updates
     * @param forceReimport - If true, reimport all documents even if unchanged
     */
    async runSync(progressCallback?: (status: string, percent: number) => void, forceReimport: boolean = false): Promise<SyncResult> {
        const result: SyncResult = {
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        try {
            progressCallback?.('Discovering documents...', 5);
            const documents = this.discoverDocuments();

            // Filter by settings
            let filteredDocs = documents;
            if (!this.settings.syncNotebooks) {
                filteredDocs = filteredDocs.filter(d => d.isPdf);
            }
            if (!this.settings.syncPDFAnnotations) {
                filteredDocs = filteredDocs.filter(d => !d.isPdf);
            }

            progressCallback?.(`Found ${filteredDocs.length} documents`, 10);

            // Ensure sync folder exists
            await this.ensureFolderExists(this.settings.syncFolder);

            // Process each document
            for (let i = 0; i < filteredDocs.length; i++) {
                const doc = filteredDocs[i];
                const percent = 10 + ((i / filteredDocs.length) * 85);
                progressCallback?.(`Processing: ${doc.visibleName}`, percent);

                try {
                    const imported = await this.syncDocument(doc, documents, forceReimport);
                    if (imported === 'new') result.imported++;
                    else if (imported === 'updated') result.updated++;
                    else result.skipped++;
                } catch (e) {
                    result.errors.push(`${doc.visibleName}: ${(e as Error).message}`);
                }
            }

            progressCallback?.('Sync complete', 100);
        } catch (e) {
            result.errors.push((e as Error).message);
        }

        return result;
    }

    /**
     * Sync a single document
     * Creates a folder for each notebook/PDF with pages as individual files
     * @param forceReimport - If true, reimport even if document hasn't changed
     */
    async syncDocument(doc: RemarkableDocument, allDocs: RemarkableDocument[], forceReimport: boolean = false): Promise<'new' | 'updated' | 'skipped'> {
        if (doc.pages.length === 0) {
            return 'skipped';
        }

        // Build destination path (parent folders from reMarkable hierarchy)
        const parentPath = this.buildFolderPath(doc, allDocs);
        await this.ensureFolderExists(parentPath);

        // Create a folder for this notebook/document
        const docName = this.sanitizeName(doc.visibleName);
        const docFolderName = doc.isPdf ? `${docName} - Annotations` : docName;
        const docFolderPath = normalizePath(`${parentPath}/${docFolderName}`);
        await this.ensureFolderExists(docFolderPath);

        // Check if document needs updating (metadata stored in the document folder)
        const metadataPath = normalizePath(`${docFolderPath}/.sync-meta.json`);
        let existingMeta: { lastModified: number } | null = null;

        if (await this.app.vault.adapter.exists(metadataPath)) {
            try {
                const metaContent = await this.app.vault.adapter.read(metadataPath);
                existingMeta = JSON.parse(metaContent);
            } catch {
                // Ignore
            }
        }

        // Skip if not modified since last sync (unless forcing reimport)
        if (!forceReimport && existingMeta && existingMeta.lastModified >= doc.lastModified) {
            return 'skipped';
        }

        // Import pages
        const conversionOptions: ConversionOptions = {
            preserveLayers: this.settings.preserveLayers,
            includeEraser: this.settings.includeEraser,
            strokeWidthScale: this.settings.strokeWidthScale
        };

        for (let pageNum = 0; pageNum < doc.pages.length; pageNum++) {
            const page = doc.pages[pageNum];

            try {
                const rmData = fs.readFileSync(page.rmPath);
                const parser = new RemarkableParser(rmData.buffer.slice(rmData.byteOffset, rmData.byteOffset + rmData.byteLength) as ArrayBuffer);
                const parseResult = parser.parse();

                if (!parseResult.success) {
                    continue;
                }

                // Skip empty pages
                const totalStrokes = parseResult.document.layers.reduce((sum, l) => sum + l.length, 0);
                if (totalStrokes === 0) continue;

                const converter = new ExcalidrawConverter(conversionOptions);
                const excalidrawJson = converter.convert(parseResult.document);

                // Each page is a separate file in the notebook folder
                const pageNumber = String(pageNum + 1).padStart(2, '0');
                const fileName = `Page ${pageNumber}.excalidraw`;
                const filePath = normalizePath(`${docFolderPath}/${fileName}`);

                // Write file
                const content = JSON.stringify(excalidrawJson, null, 2);
                if (await this.app.vault.adapter.exists(filePath)) {
                    await this.app.vault.adapter.write(filePath, content);
                } else {
                    await this.app.vault.create(filePath, content);
                }
            } catch {
                // Skip pages that fail to process
            }
        }

        // Save sync metadata in the document folder
        await this.app.vault.adapter.write(
            metadataPath,
            JSON.stringify({ lastModified: doc.lastModified, uuid: doc.uuid })
        );

        return existingMeta ? 'updated' : 'new';
    }

    /**
     * Ensure a folder exists in the vault
     */
    async ensureFolderExists(folderPath: string): Promise<void> {
        const normalizedPath = normalizePath(folderPath);

        if (await this.app.vault.adapter.exists(normalizedPath)) {
            return;
        }

        // Create parent folders if needed
        const parts = normalizedPath.split('/');
        let currentPath = '';

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }
}
