import { App, PluginSettingTab, Setting } from 'obsidian';
import type RemarkableSyncPlugin from './main';

export type SyncIntervalUnit = 'minutes' | 'hours';

export interface RemarkableSyncSettings {
    // Source settings
    remarkablePath: string;

    // Destination settings
    syncFolder: string;

    // Sync behavior
    autoSync: boolean;
    syncInterval: number;
    syncIntervalUnit: SyncIntervalUnit;

    // What to sync
    syncNotebooks: boolean;
    syncPDFAnnotations: boolean;

    // Import options
    preserveLayers: boolean;
    includeEraser: boolean;
    strokeWidthScale: number;

    // Tracking
    lastSyncTime: number;
}

export const DEFAULT_SETTINGS: RemarkableSyncSettings = {
    remarkablePath: '',
    syncFolder: 'ReMarkSync',
    autoSync: false,
    syncInterval: 30,
    syncIntervalUnit: 'minutes',
    syncNotebooks: true,
    syncPDFAnnotations: true,
    preserveLayers: true,
    includeEraser: false,
    strokeWidthScale: 0.5,
    lastSyncTime: 0
};

/**
 * Get sync interval in milliseconds
 */
export function getSyncIntervalMs(settings: RemarkableSyncSettings): number {
    const multiplier = settings.syncIntervalUnit === 'hours' ? 60 * 60 * 1000 : 60 * 1000;
    return settings.syncInterval * multiplier;
}

export class RemarkableSyncSettingTab extends PluginSettingTab {
    plugin: RemarkableSyncPlugin;

    constructor(app: App, plugin: RemarkableSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName('reMarkable sync settings').setHeading();

        // Source folder section
        new Setting(containerEl).setName('Source').setHeading();

        new Setting(containerEl)
            .setName('reMarkable data folder')
            .setDesc('Path to the reMarkable desktop app data folder. Leave empty to auto-detect.')
            .addText(text => text
                .setPlaceholder('Auto-detect')
                .setValue(this.plugin.settings.remarkablePath)
                .onChange(async (value) => {
                    this.plugin.settings.remarkablePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-detect folder')
            .setDesc('Attempt to find the reMarkable desktop app data folder automatically')
            .addButton(button => button
                .setButtonText('Detect')
                .onClick(async () => {
                    const detected = this.plugin.detectRemarkablePath();
                    if (detected) {
                        this.plugin.settings.remarkablePath = detected;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh
                    }
                }));

        // Destination folder section
        new Setting(containerEl).setName('Destination').setHeading();

        new Setting(containerEl)
            .setName('Sync folder')
            .setDesc('Folder in your vault where synced files will be stored')
            .addText(text => text
                .setPlaceholder('ReMarkSync')
                .setValue(this.plugin.settings.syncFolder)
                .onChange(async (value) => {
                    this.plugin.settings.syncFolder = value || 'ReMarkSync';
                    await this.plugin.saveSettings();
                }));

        // Auto-sync section
        new Setting(containerEl).setName('Auto sync').setHeading();

        new Setting(containerEl)
            .setName('Enable auto-sync')
            .setDesc('Automatically sync changes from reMarkable at regular intervals')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        this.plugin.startAutoSync();
                    } else {
                        this.plugin.stopAutoSync();
                    }
                }));

        // Sync interval with text input and unit toggle
        const intervalSetting = new Setting(containerEl)
            .setName('Sync interval')
            .setDesc('How often to check for changes');

        // Text input for number
        intervalSetting.addText(text => text
            .setPlaceholder('30')
            .setValue(String(this.plugin.settings.syncInterval))
            .onChange(async (value) => {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num > 0) {
                    this.plugin.settings.syncInterval = num;
                    await this.plugin.saveSettings();
                    if (this.plugin.settings.autoSync) {
                        this.plugin.restartAutoSync();
                    }
                }
            }));

        // Minutes checkbox
        intervalSetting.addToggle(toggle => toggle
            .setTooltip('Minutes')
            .setValue(this.plugin.settings.syncIntervalUnit === 'minutes')
            .onChange(async (value) => {
                if (value) {
                    this.plugin.settings.syncIntervalUnit = 'minutes';
                    await this.plugin.saveSettings();
                    if (this.plugin.settings.autoSync) {
                        this.plugin.restartAutoSync();
                    }
                    this.display(); // Refresh to update other toggle
                }
            }));

        // Add label after minutes toggle
        intervalSetting.controlEl.createSpan({ text: 'min', cls: 'setting-item-description' });

        // Hours checkbox
        intervalSetting.addToggle(toggle => toggle
            .setTooltip('Hours')
            .setValue(this.plugin.settings.syncIntervalUnit === 'hours')
            .onChange(async (value) => {
                if (value) {
                    this.plugin.settings.syncIntervalUnit = 'hours';
                    await this.plugin.saveSettings();
                    if (this.plugin.settings.autoSync) {
                        this.plugin.restartAutoSync();
                    }
                    this.display(); // Refresh to update other toggle
                }
            }));

        // Add label after hours toggle
        intervalSetting.controlEl.createSpan({ text: 'hr', cls: 'setting-item-description' });

        // What to sync section
        new Setting(containerEl).setName('Content types').setHeading();

        new Setting(containerEl)
            .setName('Sync notebooks')
            .setDesc('Import handwritten notebooks as Excalidraw files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncNotebooks)
                .onChange(async (value) => {
                    this.plugin.settings.syncNotebooks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sync PDF annotations')
            .setDesc('Import annotations from marked-up PDFs as separate Excalidraw files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncPDFAnnotations)
                .onChange(async (value) => {
                    this.plugin.settings.syncPDFAnnotations = value;
                    await this.plugin.saveSettings();
                }));

        // Import options section
        new Setting(containerEl).setName('Import options').setHeading();

        new Setting(containerEl)
            .setName('Preserve layers')
            .setDesc('Group strokes by their original layers')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.preserveLayers)
                .onChange(async (value) => {
                    this.plugin.settings.preserveLayers = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include eraser strokes')
            .setDesc('Import eraser strokes (usually not needed)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeEraser)
                .onChange(async (value) => {
                    this.plugin.settings.includeEraser = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Stroke width scale')
            .setDesc('Adjust stroke thickness (0.25 = thinner, 1.0 = original, 2.0 = thicker)')
            .addSlider(slider => slider
                .setLimits(0.25, 2.0, 0.05)
                .setValue(this.plugin.settings.strokeWidthScale)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.strokeWidthScale = value;
                    await this.plugin.saveSettings();
                }));

        // Manual sync section
        new Setting(containerEl).setName('Manual actions').setHeading();

        new Setting(containerEl)
            .setName('Sync now')
            .setDesc('Manually trigger a sync')
            .addButton(button => button
                .setButtonText('Sync now')
                .setCta()
                .onClick(async () => {
                    await this.plugin.runSync();
                }));

        new Setting(containerEl)
            .setName('Full resync')
            .setDesc('Re-import all documents (reimports everything with current settings)')
            .addButton(button => button
                .setButtonText('Full resync')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.lastSyncTime = 0;
                    await this.plugin.saveSettings();
                    await this.plugin.runSync(false, true);  // forceReimport = true
                }));

        // Status section
        new Setting(containerEl).setName('Status').setHeading();

        const lastSync = this.plugin.settings.lastSyncTime
            ? new Date(this.plugin.settings.lastSyncTime).toLocaleString()
            : 'Never';

        new Setting(containerEl)
            .setName('Last sync')
            .setDesc(lastSync);

        // Dependencies notice
        new Setting(containerEl).setName('Dependencies').setHeading();

        new Setting(containerEl)
            .setName('Excalidraw plugin required')
            .setDesc('This plugin requires the Excalidraw plugin to view imported drawings. Install it from: Settings → Community plugins → Browse → Search "Excalidraw"');
    }
}
