// ReMarkable format version enum
export enum RMVersion {
    V3 = 3,
    V5 = 5,
    V6 = 6,
    UNKNOWN = -1
}

// Pen type enumeration based on reMarkable documentation
export enum PenType {
    BALLPOINT = 0,
    MARKER = 1,
    FINELINER = 2,
    HIGHLIGHTER = 3,
    ERASER = 4,
    MECHANICAL_PENCIL = 5,
    PAINTBRUSH = 6,
    CALLIGRAPHY = 7,
    PENCIL = 8,
    BALLPOINT_V2 = 12,
    MARKER_V2 = 13,
    FINELINER_V2 = 14,
    HIGHLIGHTER_V2 = 15,
    ERASER_V2 = 16,
    MECHANICAL_PENCIL_V2 = 17,
    PAINTBRUSH_V2 = 18
}

// ReMarkable color codes
export enum RMColor {
    BLACK = 0,
    GRAY = 1,
    WHITE = 2,
    YELLOW = 3,
    GREEN = 4,
    PINK = 5,
    BLUE = 6,
    RED = 7,
    GRAY_OVERLAP = 8
}

export interface Point {
    x: number;
    y: number;
    pressure: number;
    width: number;
    speed: number;
    direction: number;
}

export interface Stroke {
    pen: PenType;
    color: RMColor;
    width: number;
    points: Point[];
    layerIndex: number;
}

export interface ParsedDocument {
    version: RMVersion;
    layers: Stroke[][];
}

export interface ParseError {
    message: string;
    offset?: number;
    details?: string;
}

export type ParseResult =
    | { success: true; document: ParsedDocument }
    | { success: false; error: ParseError };

// Excalidraw types
export interface ExcalidrawFreedrawElement {
    type: "freedraw";
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    id: string;
    fillStyle: string;
    strokeWidth: number;
    strokeStyle: string;
    roughness: number;
    opacity: number;
    angle: number;
    x: number;
    y: number;
    strokeColor: string;
    backgroundColor: string;
    width: number;
    height: number;
    seed: number;
    groupIds: string[];
    frameId: string | null;
    roundness: null;
    boundElements: null;
    updated: number;
    link: null;
    locked: boolean;
    points: number[][];
    pressures: number[];
    simulatePressure: boolean;
    lastCommittedPoint: number[] | null;
}

export interface ExcalidrawImageElement {
    type: "image";
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    id: string;
    fillStyle: string;
    strokeWidth: number;
    strokeStyle: string;
    roughness: number;
    opacity: number;
    angle: number;
    x: number;
    y: number;
    strokeColor: string;
    backgroundColor: string;
    width: number;
    height: number;
    seed: number;
    groupIds: string[];
    frameId: string | null;
    roundness: null;
    boundElements: null;
    updated: number;
    link: null;
    locked: boolean;
    status: "saved" | "pending";
    fileId: string;
    scale: [number, number];
}

export type ExcalidrawElement = ExcalidrawFreedrawElement | ExcalidrawImageElement;

export interface ExcalidrawFile {
    mimeType: string;
    id: string;
    dataURL: string;
    created: number;
}

export interface ExcalidrawDocument {
    type: "excalidraw";
    version: number;
    source: string;
    elements: ExcalidrawElement[];
    appState: {
        viewBackgroundColor: string;
        currentItemFontFamily: number;
    };
    files: Record<string, ExcalidrawFile>;
}

// Pen characteristics for conversion
export interface PenCharacteristics {
    baseMultiplier: number;
    pressureSensitive: boolean;
    opacity: number;
    roughness: number;
    strokeStyle: string;
    simulatePressure: boolean;
}

// V6 block types
export enum V6BlockType {
    LAYER_DEF = 0x1010100,
    LAYER_NAMES = 0x2020100,
    TEXT_DEF = 0x7010100,
    LAYER_INFO = 0x4010100,
    LINE_DEF = 0x5020200,
}

export interface V6Block {
    flag: number;
    length: number;
    data: Uint8Array;
}
