import { Plugin, Notice, normalizePath, Modal, App } from 'obsidian';
import { RemarkableParser } from './parser';
import { ExcalidrawConverter, ConversionOptions } from './converter';
import { getUniqueFileName } from './utils';
import { ParseResult } from './types';
import { RemarkableSyncSettings, DEFAULT_SETTINGS, RemarkableSyncSettingTab, getSyncIntervalMs } from './settings';
import { SyncManager, SyncResult } from './sync';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Progress modal for sync operations
 */
class SyncProgressModal extends Modal {
    private progressEl: HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;
    private detailsEl: HTMLElement | null = null;

    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Syncing reMarkable' });

        this.statusEl = contentEl.createEl('p', { text: 'Starting sync...' });

        const progressContainer = contentEl.createDiv({ cls: 'remarksync-progress-container' });

        this.progressEl = progressContainer.createDiv({ cls: 'remarksync-progress-bar' });

        this.detailsEl = contentEl.createEl('p', {
            cls: 'remarksync-progress-details setting-item-description'
        });
    }

    setProgress(percent: number, status: string, details?: string) {
        if (this.progressEl) {
            this.progressEl.setCssProps({ '--remarksync-progress': `${percent}%` });
        }
        if (this.statusEl) {
            this.statusEl.textContent = status;
        }
        if (this.detailsEl && details) {
            this.detailsEl.textContent = details;
        }
    }

    showResult(result: SyncResult) {
        if (this.statusEl) {
            this.statusEl.textContent = 'Sync complete';
        }
        if (this.detailsEl) {
            const parts = [];
            if (result.imported > 0) parts.push(`${result.imported} new`);
            if (result.updated > 0) parts.push(`${result.updated} updated`);
            if (result.skipped > 0) parts.push(`${result.skipped} unchanged`);
            if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);

            this.detailsEl.textContent = parts.join(', ');
        }
        if (this.progressEl) {
            this.progressEl.setCssProps({ '--remarksync-progress': '100%' });
            if (result.errors.length > 0) {
                this.progressEl.addClass('remarksync-progress-bar--warning');
            } else {
                this.progressEl.addClass('remarksync-progress-bar--success');
            }
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Progress modal for file imports
 */
class ImportProgressModal extends Modal {
    private progressEl: HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;

    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Importing reMarkable file' });

        this.statusEl = contentEl.createEl('p', { text: 'Parsing file...' });

        const progressContainer = contentEl.createDiv({ cls: 'remarksync-progress-container' });

        this.progressEl = progressContainer.createDiv({ cls: 'remarksync-progress-bar' });
    }

    setProgress(percent: number, status: string) {
        if (this.progressEl) {
            this.progressEl.setCssProps({ '--remarksync-progress': `${percent}%` });
        }
        if (this.statusEl) {
            this.statusEl.textContent = status;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class RemarkableSyncPlugin extends Plugin {
    settings: RemarkableSyncSettings = DEFAULT_SETTINGS;
    private syncManager: SyncManager | null = null;
    private autoSyncInterval: ReturnType<typeof setInterval> | null = null;

    async onload() {
        await this.loadSettings();

        // Initialize sync manager
        this.syncManager = new SyncManager(this.app, this.settings);

        // Add settings tab
        this.addSettingTab(new RemarkableSyncSettingTab(this.app, this));

        // Add ribbon icon for manual import
        this.addRibbonIcon('file-input', 'Import .rm file', () => {
            this.triggerImport();
        });

        // Add ribbon icon for sync
        this.addRibbonIcon('refresh-cw', 'Sync reMarkable', async () => {
            await this.runSync();
        });

        // Add commands
        this.addCommand({
            id: 'import-rm-file',
            name: 'Import reMarkable .rm file',
            callback: () => this.triggerImport()
        });

        this.addCommand({
            id: 'sync-remarkable',
            name: 'Sync from reMarkable',
            callback: () => void this.runSync()
        });

        this.addCommand({
            id: 'full-resync-remarkable',
            name: 'Full resync from reMarkable',
            callback: async () => {
                this.settings.lastSyncTime = 0;
                await this.saveSettings();
                await this.runSync(false, true);  // forceReimport = true
            }
        });

        // Start auto-sync if enabled
        if (this.settings.autoSync) {
            this.startAutoSync();
        }
    }

    onunload() {
        this.stopAutoSync();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.syncManager?.updateSettings(this.settings);
    }

    /**
     * Detect reMarkable desktop app path
     */
    detectRemarkablePath(): string | null {
        const homeDir = process.env.HOME || '';
        const possiblePaths = [
            path.join(homeDir, 'Library/Containers/com.remarkable.desktop/Data/Library/Application Support/remarkable/desktop'),
            path.join(homeDir, 'Library/Application Support/remarkable/desktop'),
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                new Notice(`Found reMarkable data at: ${p}`);
                return p;
            }
        }

        new Notice('Could not find reMarkable desktop app data folder');
        return null;
    }

    /**
     * Start auto-sync interval
     */
    startAutoSync() {
        this.stopAutoSync();
        const intervalMs = getSyncIntervalMs(this.settings);
        this.autoSyncInterval = setInterval(() => {
            this.runSync(true); // Silent mode for auto-sync
        }, intervalMs);
    }

    /**
     * Stop auto-sync interval
     */
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    }

    /**
     * Restart auto-sync with new interval
     */
    restartAutoSync() {
        if (this.settings.autoSync) {
            this.startAutoSync();
        }
    }

    /**
     * Run sync operation
     * @param silent - If true, don't show progress modal
     * @param forceReimport - If true, reimport all documents even if unchanged
     */
    async runSync(silent: boolean = false, forceReimport: boolean = false) {
        if (!this.syncManager) return;

        let modal: SyncProgressModal | null = null;

        if (!silent) {
            modal = new SyncProgressModal(this.app);
            modal.open();
        }

        try {
            const result = await this.syncManager.runSync((status, percent) => {
                modal?.setProgress(percent, status);
            }, forceReimport);

            // Update last sync time
            this.settings.lastSyncTime = Date.now();
            await this.saveSettings();

            if (modal) {
                modal.showResult(result);
                await sleep(1500);
                modal.close();
            }

            // Show notification
            if (result.imported > 0 || result.updated > 0) {
                new Notice(`Synced: ${result.imported} new, ${result.updated} updated`);
            } else if (!silent) {
                new Notice('No changes to sync');
            }

            if (result.errors.length > 0 && !silent) {
                new Notice(`${result.errors.length} errors during sync`);
            }
        } catch (e) {
            modal?.close();
            new Notice(`Sync failed: ${(e as Error).message}`);
        }
    }

    /**
     * Open file picker and trigger import
     */
    triggerImport(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.rm';
        input.multiple = true;

        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const files = Array.from(target.files || []);
            if (files.length === 0) return;

            const progressModal = new ImportProgressModal(this.app);
            progressModal.open();

            (async () => {
                try {
                    const results: string[] = [];

                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const fileProgress = ((i) / files.length) * 100;

                        progressModal.setProgress(
                            fileProgress + 10,
                            `Parsing ${file.name} (${i + 1}/${files.length})...`
                        );

                        const savedPath = await this.processFile(file, progressModal, fileProgress);
                        results.push(savedPath);
                    }

                    progressModal.setProgress(100, 'Complete');
                    await sleep(500);
                    progressModal.close();

                    new Notice(`Successfully imported ${files.length} file(s)`);
                } catch (error) {
                    progressModal.close();
                    new Notice(`Import failed: ${(error as Error).message}`);
                }
            })();
        };

        input.click();
    }

    /**
     * Process a single .rm file
     */
    async processFile(file: File, progressModal: ImportProgressModal, baseProgress: number): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();

        const parser = new RemarkableParser(arrayBuffer);
        const result: ParseResult = parser.parse();

        if (!result.success) {
            throw new Error(
                `Failed to parse ${file.name}: ${result.error.message}` +
                (result.error.offset ? ` (at byte ${result.error.offset})` : '')
            );
        }

        progressModal.setProgress(baseProgress + 40, `Converting ${file.name}...`);

        const conversionOptions: ConversionOptions = {
            preserveLayers: this.settings.preserveLayers,
            includeEraser: this.settings.includeEraser,
            strokeWidthScale: this.settings.strokeWidthScale
        };

        const converter = new ExcalidrawConverter(conversionOptions);
        const excalidrawJson = converter.convert(result.document);

        progressModal.setProgress(baseProgress + 70, `Saving ${file.name}...`);

        const baseName = file.name.replace(/\.rm$/i, '');
        const uniquePath = await getUniqueFileName(
            this.app.vault,
            normalizePath(baseName),
            'excalidraw'
        );

        await this.app.vault.create(
            uniquePath,
            JSON.stringify(excalidrawJson, null, 2)
        );

        return uniquePath;
    }
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
