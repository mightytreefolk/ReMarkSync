import {
    Stroke, ExcalidrawElement, ExcalidrawFreedrawElement, ExcalidrawImageElement,
    ExcalidrawDocument, ExcalidrawFile, PenType, ParsedDocument, PenCharacteristics
} from './types';
import { getHexColor, getPenCharacteristics } from './constants';
import {
    generateId, generateSeed, normalizePressure,
    calculateStrokeWidth
} from './utils';

export interface ConversionOptions {
    preserveLayers: boolean;
    includeEraser: boolean;
    strokeWidthScale: number;
}

const DEFAULT_OPTIONS: ConversionOptions = {
    preserveLayers: true,
    includeEraser: false,
    strokeWidthScale: 0.5
};

export class ExcalidrawConverter {
    private options: ConversionOptions;
    private layerGroupIds: Map<number, string> = new Map();

    constructor(options: Partial<ConversionOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Background image data for PDF pages
     */
    public backgroundImage?: {
        dataUrl: string;
        width: number;
        height: number;
    };

    /**
     * Set a background image (e.g., PDF page) for the output
     */
    setBackgroundImage(dataUrl: string, width: number, height: number): void {
        this.backgroundImage = { dataUrl, width, height };
    }

    /**
     * Convert a parsed ReMarkable document to Excalidraw format
     */
    convert(document: ParsedDocument): ExcalidrawDocument {
        const elements: ExcalidrawElement[] = [];
        const files: Record<string, ExcalidrawFile> = {};

        // Add background image if set (for PDF annotations)
        if (this.backgroundImage) {
            const fileId = generateId();
            const imageElement = this.createBackgroundImageElement(
                fileId,
                this.backgroundImage.width,
                this.backgroundImage.height
            );
            elements.push(imageElement);

            // Add the file data
            files[fileId] = {
                mimeType: "image/png",
                id: fileId,
                dataURL: this.backgroundImage.dataUrl,
                created: Date.now()
            };
        }

        // Generate group IDs for each layer
        if (this.options.preserveLayers) {
            document.layers.forEach((_, index) => {
                this.layerGroupIds.set(index, generateId());
            });
        }

        // Process all layers
        document.layers.forEach((layer, layerIndex) => {
            layer.forEach(stroke => {
                // Skip eraser strokes unless explicitly included
                if (!this.options.includeEraser && this.isEraserStroke(stroke)) {
                    return;
                }

                const element = this.convertStroke(stroke, layerIndex);
                if (element) {
                    elements.push(element);
                }
            });
        });

        return {
            type: "excalidraw",
            version: 2,
            source: "obsidian-remarkable-import",
            elements,
            appState: {
                viewBackgroundColor: "#ffffff",
                currentItemFontFamily: 1
            },
            files
        };
    }

    /**
     * Create a background image element for PDF pages
     */
    private createBackgroundImageElement(
        fileId: string,
        width: number,
        height: number
    ): ExcalidrawImageElement {
        return {
            type: "image",
            version: 1,
            versionNonce: Date.now(),
            isDeleted: false,
            id: generateId(),
            fillStyle: "solid",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 0,
            opacity: 100,
            angle: 0,
            x: 0,
            y: 0,
            strokeColor: "transparent",
            backgroundColor: "transparent",
            width: width,
            height: height,
            seed: generateSeed(),
            groupIds: [],
            frameId: null,
            roundness: null,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: true,  // Lock the background so it can't be moved
            status: "saved",
            fileId: fileId,
            scale: [1, 1]
        };
    }

    /**
     * Check if a stroke is from an eraser tool
     */
    private isEraserStroke(stroke: Stroke): boolean {
        return stroke.pen === PenType.ERASER ||
            stroke.pen === PenType.ERASER_V2;
    }

    /**
     * Convert a single stroke to an Excalidraw freedraw element
     */
    private convertStroke(stroke: Stroke, layerIndex: number): ExcalidrawFreedrawElement | null {
        if (stroke.points.length === 0) {
            return null;
        }

        // Get pen characteristics
        const penChar = getPenCharacteristics(stroke.pen);

        // Map color properly
        const strokeColor = getHexColor(stroke.color);

        // Calculate actual stroke width with scale factor
        const strokeWidth = calculateStrokeWidth(
            stroke.width,
            penChar.baseMultiplier,
            this.options.strokeWidthScale
        );

        // Extract raw points
        const rawPoints = stroke.points.map(p => [p.x, p.y]);

        // Calculate bounding box
        const xs = rawPoints.map(p => p[0]);
        const ys = rawPoints.map(p => p[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        // Convert to relative points
        const relativePoints = rawPoints.map(p => [p[0] - minX, p[1] - minY]);

        // Populate pressures array
        const pressures = this.calculatePressures(stroke, penChar);

        // Set group ID based on layer
        const groupIds: string[] = [];
        if (this.options.preserveLayers) {
            const groupId = this.layerGroupIds.get(layerIndex);
            if (groupId) {
                groupIds.push(groupId);
            }
        }

        // Build the Excalidraw freedraw element with pen-specific characteristics
        const element: ExcalidrawFreedrawElement = {
            type: "freedraw",
            version: 1,
            versionNonce: Date.now(),
            isDeleted: false,
            id: generateId(),
            fillStyle: "solid",
            strokeWidth: strokeWidth,
            strokeStyle: penChar.strokeStyle,
            roughness: penChar.roughness,
            opacity: penChar.opacity,
            angle: 0,
            x: minX,
            y: minY,
            strokeColor: strokeColor,
            backgroundColor: "transparent",
            width: maxX - minX,
            height: maxY - minY,
            seed: generateSeed(),
            groupIds: groupIds,
            frameId: null,
            roundness: null,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            points: relativePoints,
            pressures: pressures,
            simulatePressure: penChar.simulatePressure,
            lastCommittedPoint: null
        };

        return element;
    }

    /**
     * Calculate pressures based on pen type
     */
    private calculatePressures(stroke: Stroke, penChar: PenCharacteristics): number[] {
        if (!penChar.pressureSensitive) {
            // For non-pressure-sensitive pens, use uniform pressure
            return stroke.points.map(() => 0.5);
        }

        // Use actual pressure values from the stroke
        return stroke.points.map(point => normalizePressure(point.pressure));
    }
}
