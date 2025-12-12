import {
    RMVersion, PenType, RMColor, Point, Stroke,
    ParseResult, V6BlockType
} from './types';
import { HEADER_V3, HEADER_V5, HEADER_V6, HEADER_SIZES } from './constants';

// V6 constants
const V6_HEADER_SIZE = 43;
const V6_POINT_SIZE = 14;

// V6 tag types
const V6TagType = {
    ID: 0xF,
    Length4: 0xC,
    Byte8: 0x8,
    Byte4: 0x4,
    Byte1: 0x1
};

interface HeaderValidation {
    valid: boolean;
    version: RMVersion;
    error?: string;
}

type LayerResult =
    | { success: true; strokes: Stroke[] }
    | { success: false; error: string };

type StrokeResult =
    | { success: true; stroke: Stroke }
    | { success: false; error: string };

export class RemarkableParser {
    private cursor: number = 0;
    private view: DataView;
    private buffer: ArrayBuffer;
    private decoder: TextDecoder;
    private version: RMVersion = RMVersion.UNKNOWN;

    constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this.decoder = new TextDecoder("utf-8");
    }

    /**
     * Validate header magic string and detect version
     */
    private validateHeader(): HeaderValidation {
        // Check minimum buffer size for header
        if (this.buffer.byteLength < 33) {
            return {
                valid: false,
                version: RMVersion.UNKNOWN,
                error: `File too small: ${this.buffer.byteLength} bytes, minimum 33 required`
            };
        }

        // Read the header string (up to 43 bytes to cover all versions)
        const headerBytes = new Uint8Array(this.buffer, 0, Math.min(43, this.buffer.byteLength));
        const headerText = this.decoder.decode(headerBytes);

        // Detect version from header
        if (headerText.startsWith(HEADER_V6)) {
            return { valid: true, version: RMVersion.V6 };
        } else if (headerText.startsWith(HEADER_V5)) {
            return { valid: true, version: RMVersion.V5 };
        } else if (headerText.startsWith(HEADER_V3)) {
            return { valid: true, version: RMVersion.V3 };
        } else if (headerText.startsWith("reMarkable .lines file, version=")) {
            // Unknown version - try to parse version number
            const match = headerText.match(/version=(\d+)/);
            if (match) {
                const versionNum = parseInt(match[1], 10);
                return {
                    valid: false,
                    version: RMVersion.UNKNOWN,
                    error: `Unsupported version: ${versionNum}. Supported versions: 3, 5, 6`
                };
            }
        }

        return {
            valid: false,
            version: RMVersion.UNKNOWN,
            error: "Invalid file format: missing reMarkable header magic string"
        };
    }

    /**
     * Main parse method with proper error handling
     */
    parse(): ParseResult {
        try {
            // Step 1: Validate header
            const headerResult = this.validateHeader();
            if (!headerResult.valid) {
                return {
                    success: false,
                    error: {
                        message: headerResult.error || "Invalid header",
                        offset: 0
                    }
                };
            }

            this.version = headerResult.version;

            // Step 2: Handle different versions
            if (this.version === RMVersion.V6) {
                return this.parseV6();
            } else if (this.version === RMVersion.V5 || this.version === RMVersion.V3) {
                return this.parseV5();
            }

            return {
                success: false,
                error: {
                    message: `Cannot parse version ${this.version}`,
                    offset: 0
                }
            };
        } catch (e) {
            const error = e as Error;
            return {
                success: false,
                error: {
                    message: `Parse error: ${error.message}`,
                    offset: this.cursor,
                    details: error.stack
                }
            };
        }
    }

    /**
     * Parse v5 format (also handles v3 with adjustments)
     */
    private parseV5(): ParseResult {
        const headerSize = HEADER_SIZES[this.version] || 43;
        this.cursor = headerSize;

        // Check if we have enough bytes for layer count
        if (this.cursor + 4 > this.buffer.byteLength) {
            return {
                success: false,
                error: {
                    message: "Unexpected end of file: cannot read layer count",
                    offset: this.cursor
                }
            };
        }

        const numLayers = this.getInt32();

        if (numLayers < 0 || numLayers > 100) {
            return {
                success: false,
                error: {
                    message: `Invalid layer count: ${numLayers}. Expected 0-100.`,
                    offset: this.cursor - 4
                }
            };
        }

        const layers: Stroke[][] = [];

        for (let layerIndex = 0; layerIndex < numLayers; layerIndex++) {
            const layerResult = this.parseLayer(layerIndex);
            if (!layerResult.success) {
                return {
                    success: false,
                    error: {
                        message: `Failed to parse layer ${layerIndex}: ${layerResult.error}`,
                        offset: this.cursor
                    }
                };
            }
            layers.push(layerResult.strokes);
        }

        return {
            success: true,
            document: {
                version: this.version,
                layers
            }
        };
    }

    /**
     * Parse v6 format - block-based structure with tagged values
     */
    private parseV6(): ParseResult {
        this.cursor = V6_HEADER_SIZE;

        const strokes: Stroke[] = [];

        // Scan through the file looking for blocks
        while (this.cursor + 8 <= this.buffer.byteLength) {
            const blockStart = this.cursor;

            const length = this.getUint32();
            const flag = this.getUint32();

            // Validate block
            if (length === 0 || length > this.buffer.byteLength - this.cursor || length > 10000000) {
                this.cursor = blockStart + 1;
                continue;
            }

            // Check if this is a LINE_DEF block
            if (flag === (V6BlockType.LINE_DEF as number)) {
                const blockEnd = this.cursor + length;
                const strokeResult = this.parseV6Stroke(blockEnd);

                if (strokeResult.success && strokeResult.stroke.points.length > 0) {
                    strokes.push(strokeResult.stroke);
                }

                this.cursor = blockEnd;
            } else {
                this.cursor += length;
            }
        }

        // Put all strokes in layer 0 for now
        const layers: Stroke[][] = [strokes];

        return {
            success: true,
            document: {
                version: this.version,
                layers
            }
        };
    }

    /**
     * Read a varuint (variable-length unsigned integer)
     */
    private readVaruint(): number {
        let result = 0;
        let shift = 0;
        while (this.cursor < this.buffer.byteLength) {
            const byte = this.view.getUint8(this.cursor++);
            result |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
        }
        return result;
    }

    /**
     * Skip a CRDT ID (two varuints)
     */
    private skipCrdtId(): void {
        this.readVaruint();
        this.readVaruint();
    }

    /**
     * Parse a v6 stroke from a LINE_DEF block using tagged values
     */
    private parseV6Stroke(blockEnd: number): StrokeResult {
        let pen: PenType = PenType.BALLPOINT;
        let color: RMColor = RMColor.BLACK;
        let thickness = 1.0;
        const points: Point[] = [];

        try {
            while (this.cursor < blockEnd) {
                const tag = this.readVaruint();
                const index = tag >> 4;
                const type = tag & 0xF;

                switch (index) {
                    case 1: // Pen/Tool ID
                        if (type === V6TagType.Byte4) {
                            pen = this.getUint32() as PenType;
                        } else if (type === V6TagType.ID) {
                            this.skipCrdtId();
                        }
                        break;

                    case 2: // Color
                        if (type === V6TagType.Byte4) {
                            color = this.getUint32() as RMColor;
                        } else if (type === V6TagType.ID) {
                            this.skipCrdtId();
                        }
                        break;

                    case 3: // Thickness scale (double)
                        if (type === V6TagType.Byte8) {
                            thickness = this.getFloat64();
                        }
                        break;

                    case 4: // Starting length (float)
                        if (type === V6TagType.Byte4) {
                            this.getFloat32(); // Skip, not needed
                        }
                        break;

                    case 5: // Points subblock
                        if (type === V6TagType.Length4) {
                            const pointsLen = this.getUint32();
                            const numPoints = Math.floor(pointsLen / V6_POINT_SIZE);

                            for (let i = 0; i < numPoints && this.cursor + V6_POINT_SIZE <= blockEnd; i++) {
                                const x = this.getFloat32();
                                const y = this.getFloat32();
                                const speed = this.getUint16();
                                const width = this.getUint16();
                                const direction = this.getUint8();
                                const pressure = this.getUint8();

                                points.push({
                                    x,
                                    y,
                                    speed: speed / 65535,
                                    width: width / 65535,
                                    direction: (direction / 255) * 360,
                                    pressure: pressure / 255
                                });
                            }
                        }
                        break;

                    case 6: // Timestamp
                    case 7: // Move ID
                        if (type === V6TagType.ID) {
                            this.skipCrdtId();
                        }
                        break;

                    default:
                        // Skip unknown tags
                        if (type === V6TagType.Byte1) this.cursor += 1;
                        else if (type === V6TagType.Byte4) this.cursor += 4;
                        else if (type === V6TagType.Byte8) this.cursor += 8;
                        else if (type === V6TagType.Length4) {
                            const len = this.getUint32();
                            this.cursor += len;
                        } else if (type === V6TagType.ID) {
                            this.skipCrdtId();
                        }
                        break;
                }
            }

            return {
                success: true,
                stroke: {
                    pen,
                    color,
                    width: thickness,
                    points,
                    layerIndex: 0
                }
            };
        } catch (e) {
            return { success: false, error: `V6 stroke parse error: ${(e as Error).message}` };
        }
    }

    /**
     * Read unsigned 32-bit integer (little-endian)
     */
    private getUint32(): number {
        const val = this.view.getUint32(this.cursor, true);
        this.cursor += 4;
        return val;
    }

    /**
     * Read unsigned 16-bit integer (little-endian)
     */
    private getUint16(): number {
        const val = this.view.getUint16(this.cursor, true);
        this.cursor += 2;
        return val;
    }

    /**
     * Read unsigned 8-bit integer
     */
    private getUint8(): number {
        const val = this.view.getUint8(this.cursor);
        this.cursor += 1;
        return val;
    }

    /**
     * Read 64-bit float (little-endian)
     */
    private getFloat64(): number {
        const val = this.view.getFloat64(this.cursor, true);
        this.cursor += 8;
        return val;
    }

    /**
     * Parse a single layer
     */
    private parseLayer(layerIndex: number): LayerResult {
        if (this.cursor + 4 > this.buffer.byteLength) {
            return { success: false, error: "Cannot read stroke count" };
        }

        const numStrokes = this.getInt32();

        if (numStrokes < 0 || numStrokes > 100000) {
            return { success: false, error: `Invalid stroke count: ${numStrokes}` };
        }

        const strokes: Stroke[] = [];

        for (let i = 0; i < numStrokes; i++) {
            const strokeResult = this.parseStroke(layerIndex);
            if (!strokeResult.success) {
                return { success: false, error: `Stroke ${i}: ${strokeResult.error}` };
            }
            strokes.push(strokeResult.stroke);
        }

        return { success: true, strokes };
    }

    /**
     * Parse a single stroke
     */
    private parseStroke(layerIndex: number): StrokeResult {
        // v5 stroke structure: 24 bytes header + points
        // v3 stroke structure: 20 bytes header + points
        const headerSize = this.version === RMVersion.V3 ? 20 : 24;

        if (this.cursor + headerSize > this.buffer.byteLength) {
            return { success: false, error: "Cannot read stroke header" };
        }

        const pen = this.getInt32() as PenType;
        const color = this.getInt32() as RMColor;
        this.getInt32(); // Padding/selection flag (unused)
        const baseWidth = this.getFloat32();

        // v5 has an extra field
        if (this.version !== RMVersion.V3) {
            this.getInt32(); // Skip unknown v5 field
        }

        const numPoints = this.getInt32();

        if (numPoints < 0 || numPoints > 100000) {
            return { success: false, error: `Invalid point count: ${numPoints}` };
        }

        // Each point is 24 bytes in v5 (6 floats)
        const pointSize = 24;
        if (this.cursor + (numPoints * pointSize) > this.buffer.byteLength) {
            return {
                success: false,
                error: `Not enough bytes for ${numPoints} points`
            };
        }

        const points: Point[] = [];
        for (let j = 0; j < numPoints; j++) {
            points.push({
                x: this.getFloat32(),
                y: this.getFloat32(),
                speed: this.getFloat32(),
                direction: this.getFloat32(),
                width: this.getFloat32(),
                pressure: this.getFloat32()
            });
        }

        return {
            success: true,
            stroke: {
                pen,
                color,
                width: baseWidth,
                points,
                layerIndex
            }
        };
    }

    /**
     * Read a 32-bit signed integer (little-endian)
     */
    private getInt32(): number {
        const val = this.view.getInt32(this.cursor, true);
        this.cursor += 4;
        return val;
    }

    /**
     * Read a 32-bit float (little-endian)
     */
    private getFloat32(): number {
        const val = this.view.getFloat32(this.cursor, true);
        this.cursor += 4;
        return val;
    }
}
