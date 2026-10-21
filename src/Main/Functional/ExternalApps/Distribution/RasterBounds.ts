/** Reads raster dimensions before native decoding, bounding decompression work for remote icons. */
export function rasterDimensions(bytes: Buffer): readonly [number, number] {
    if (
        bytes.length >= 24 &&
        bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
        bytes.toString('ascii', 12, 16) === 'IHDR'
    )
        return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 4 < bytes.length) {
            if (bytes[offset++] !== 0xff) break;
            while (bytes[offset] === 0xff) offset++;
            const marker = bytes[offset++];
            if (marker === 0xda || marker === 0xd9) break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
            if (offset + 2 > bytes.length) break;
            const length = bytes.readUInt16BE(offset);
            if (length < 2 || offset + length > bytes.length) break;
            if (
                [
                    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb,
                    0xcd, 0xce, 0xcf,
                ].includes(marker) &&
                length >= 7
            )
                return [
                    bytes.readUInt16BE(offset + 5),
                    bytes.readUInt16BE(offset + 3),
                ];
            offset += length;
        }
    }
    if (
        bytes.length >= 30 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP'
    ) {
        const kind = bytes.toString('ascii', 12, 16);
        if (kind === 'VP8X')
            return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
        if (
            kind === 'VP8 ' &&
            bytes.subarray(23, 26).toString('hex') === '9d012a'
        )
            return [
                bytes.readUInt16LE(26) & 0x3fff,
                bytes.readUInt16LE(28) & 0x3fff,
            ];
        if (kind === 'VP8L' && bytes[20] === 0x2f) {
            const bits = bytes.readUInt32LE(21);
            return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
        }
    }
    throw new Error('Supported raster icon header required.');
}
