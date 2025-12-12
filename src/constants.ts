import { PenType, RMColor, PenCharacteristics } from './types';

// ReMarkable coordinate system dimensions
export const RM_WIDTH = 1404;
export const RM_HEIGHT = 1872;

// Header magic strings for version detection
export const HEADER_V3 = "reMarkable .lines file, version=3";
export const HEADER_V5 = "reMarkable .lines file, version=5";
export const HEADER_V6 = "reMarkable .lines file, version=6";

// Header sizes by version
export const HEADER_SIZES: Record<number, number> = {
    3: 33,  // v3 has shorter header
    5: 43,  // v5 has 33-byte text + padding
    6: 43   // v6 uses same header size but different structure after
};

// Color mapping: ReMarkable color code -> Hex color
export const COLOR_MAP: Record<RMColor, string> = {
    [RMColor.BLACK]: "#000000",
    [RMColor.GRAY]: "#808080",
    [RMColor.WHITE]: "#FFFFFF",
    [RMColor.YELLOW]: "#FFEB3B",
    [RMColor.GREEN]: "#4CAF50",
    [RMColor.PINK]: "#E91E63",
    [RMColor.BLUE]: "#2196F3",
    [RMColor.RED]: "#F44336",
    [RMColor.GRAY_OVERLAP]: "#A0A0A0"
};

// Pen type characteristics
// baseMultiplier values calibrated for ReMarkable thickness values (typically 1.0-3.0)
// Combined with default strokeWidthScale of 0.5, these produce visually similar stroke widths
export const PEN_CHARACTERISTICS: Partial<Record<PenType, PenCharacteristics>> = {
    [PenType.BALLPOINT]: {
        baseMultiplier: 1.0,
        pressureSensitive: true,
        opacity: 100,
        roughness: 0,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.BALLPOINT_V2]: {
        baseMultiplier: 1.0,
        pressureSensitive: true,
        opacity: 100,
        roughness: 0,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.MARKER]: {
        baseMultiplier: 1.8,
        pressureSensitive: true,
        opacity: 100,
        roughness: 1,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.MARKER_V2]: {
        baseMultiplier: 1.8,
        pressureSensitive: true,
        opacity: 100,
        roughness: 1,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.FINELINER]: {
        baseMultiplier: 0.6,
        pressureSensitive: false,
        opacity: 100,
        roughness: 0,
        strokeStyle: "solid",
        simulatePressure: true
    },
    [PenType.FINELINER_V2]: {
        baseMultiplier: 0.6,
        pressureSensitive: false,
        opacity: 100,
        roughness: 0,
        strokeStyle: "solid",
        simulatePressure: true
    },
    [PenType.HIGHLIGHTER]: {
        baseMultiplier: 8.0,
        pressureSensitive: false,
        opacity: 40,
        roughness: 1,
        strokeStyle: "solid",
        simulatePressure: true
    },
    [PenType.HIGHLIGHTER_V2]: {
        baseMultiplier: 8.0,
        pressureSensitive: false,
        opacity: 40,
        roughness: 1,
        strokeStyle: "solid",
        simulatePressure: true
    },
    [PenType.ERASER]: {
        baseMultiplier: 2.0,
        pressureSensitive: true,
        opacity: 100,
        roughness: 0,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.ERASER_V2]: {
        baseMultiplier: 2.0,
        pressureSensitive: true,
        opacity: 100,
        roughness: 0,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.MECHANICAL_PENCIL]: {
        baseMultiplier: 0.5,
        pressureSensitive: true,
        opacity: 90,
        roughness: 1,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.MECHANICAL_PENCIL_V2]: {
        baseMultiplier: 0.5,
        pressureSensitive: true,
        opacity: 90,
        roughness: 1,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.PAINTBRUSH]: {
        baseMultiplier: 2.5,
        pressureSensitive: true,
        opacity: 100,
        roughness: 2,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.PAINTBRUSH_V2]: {
        baseMultiplier: 2.5,
        pressureSensitive: true,
        opacity: 100,
        roughness: 2,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.CALLIGRAPHY]: {
        baseMultiplier: 1.5,
        pressureSensitive: true,
        opacity: 100,
        roughness: 0,
        strokeStyle: "solid",
        simulatePressure: false
    },
    [PenType.PENCIL]: {
        baseMultiplier: 1.0,
        pressureSensitive: true,
        opacity: 85,
        roughness: 2,
        strokeStyle: "solid",
        simulatePressure: false
    }
};

// Default characteristics for unknown pen types
export const DEFAULT_PEN_CHARACTERISTICS: PenCharacteristics = {
    baseMultiplier: 1.0,
    pressureSensitive: true,
    opacity: 100,
    roughness: 1,
    strokeStyle: "solid",
    simulatePressure: false
};

/**
 * Get pen characteristics with fallback to default
 */
export function getPenCharacteristics(pen: PenType): PenCharacteristics {
    return PEN_CHARACTERISTICS[pen] ?? DEFAULT_PEN_CHARACTERISTICS;
}

/**
 * Get hex color from ReMarkable color code with fallback
 */
export function getHexColor(color: RMColor): string {
    return COLOR_MAP[color] ?? COLOR_MAP[RMColor.BLACK];
}
