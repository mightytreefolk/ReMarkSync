import type { Vault } from 'obsidian';

/**
 * Generate a unique ID using crypto API
 */
export function generateId(): string {
    // Use crypto API if available (modern browsers and Node.js)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback using crypto.getRandomValues for Obsidian environment
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    }

    // Last resort fallback
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a random seed for Excalidraw (32-bit integer)
 */
export function generateSeed(): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return arr[0];
    }
    return Math.floor(Math.random() * 2147483647);
}

/**
 * Generate unique file name to avoid conflicts
 */
export async function getUniqueFileName(
    vault: Vault,
    basePath: string,
    extension: string
): Promise<string> {
    const fullPath = `${basePath}.${extension}`;

    // Check if file exists using the vault adapter
    const exists = await vault.adapter.exists(fullPath);
    if (!exists) {
        return fullPath;
    }

    // Generate unique name with counter
    let counter = 1;
    let newPath: string;
    do {
        newPath = `${basePath} (${counter}).${extension}`;
        counter++;
    } while (await vault.adapter.exists(newPath) && counter < 1000);

    return newPath;
}

/**
 * Normalize pressure values to 0-1 range
 */
export function normalizePressure(pressure: number): number {
    return Math.max(0, Math.min(1, pressure));
}

/**
 * Calculate effective stroke width based on base width, pen characteristics, and user scale
 */
export function calculateStrokeWidth(
    baseWidth: number,
    multiplier: number,
    scale: number = 0.5
): number {
    // Apply pen multiplier and user scale, then clamp to reasonable range for Excalidraw (1-16)
    const width = baseWidth * multiplier * scale;
    return Math.max(1, Math.min(16, width));
}
