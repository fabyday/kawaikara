import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

/** A deliberate read rejection; callers translate it into their domain's public error. */
export class FileReadError extends Error {
    /** @param reason Whether the input is non-regular/linked or exceeds the caller's byte budget. */
    constructor(readonly reason: 'unsafe-file' | 'too-large') {
        super(reason);
    }
}

/** Constraints for reading untrusted local files. Schema and text encoding stay with the caller. */
export interface FileReadOptions {
    /** Maximum number of bytes; growing files are also bounded during the read. */
    readonly maxBytes?: number;
    /** Reject a symbolic link at the final path component. Parent ownership is checked by the domain. */
    readonly rejectSymbolicLinks?: boolean;
}

/**
 * Reads a regular file through one descriptor and closes it on success or failure.
 * @param filePath Path already selected or validated by the owning feature.
 * @param options Explicit size/link policy; links remain allowed for existing manifest loading behavior.
 * @returns File bytes, without decoding or schema interpretation.
 * @throws FileReadError for non-regular files and size violations; OS errors propagate unchanged.
 */
export async function readFileBytes(
    filePath: string,
    options: FileReadOptions = {},
): Promise<Buffer> {
    const limit = options.maxBytes;
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0))
        throw new RangeError('Invalid file read limit.');
    const candidate = await lstat(filePath);
    if (options.rejectSymbolicLinks && candidate.isSymbolicLink())
        throw new FileReadError('unsafe-file');
    if (!candidate.isSymbolicLink() && !candidate.isFile())
        throw new FileReadError('unsafe-file');
    const file = await open(
        filePath,
        constants.O_RDONLY |
            (options.rejectSymbolicLinks ? constants.O_NOFOLLOW : 0),
    ).catch((error) => {
        if (options.rejectSymbolicLinks && error.code === 'ELOOP')
            throw new FileReadError('unsafe-file');
        throw error;
    });
    try {
        const info = await file.stat();
        if (!info.isFile()) throw new FileReadError('unsafe-file');
        if (limit !== undefined && info.size > limit)
            throw new FileReadError('too-large');
        if (limit === undefined) return await file.readFile();
        const chunks: Buffer[] = [];
        let total = 0;
        for (;;) {
            const chunk = Buffer.alloc(Math.min(64 * 1024, limit - total + 1));
            const { bytesRead } = await file.read(chunk, 0, chunk.length, null);
            if (!bytesRead) break;
            total += bytesRead;
            if (total > limit) throw new FileReadError('too-large');
            chunks.push(chunk.subarray(0, bytesRead));
        }
        return Buffer.concat(chunks, total);
    } finally {
        await file.close();
    }
}
