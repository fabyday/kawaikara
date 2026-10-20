import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** PNG-only wire payload, at most 32 KiB; never accept remote URLs or executable SVG. */
export interface ExternalAppIcon {
    /** Whether the hash option is enabled. */
    hash: string;
    /** The png value. */
    png: string;
}
/** Defines the shared limit constant. */
const LIMIT = 32768;
/** Bounds decoded image dimensions before passing bytes to the native decoder. */
function pngBytes(base64: unknown): Buffer {
    if (
        typeof base64 !== 'string' ||
        base64.length > Math.ceil(LIMIT / 3) * 4 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
    )
        throw new Error('Invalid app icon.');
    const data = Buffer.from(base64, 'base64');
    if (
        data.length < 33 ||
        data.length > LIMIT ||
        data.toString('base64') !== base64 ||
        data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        data.subarray(12, 16).toString() !== 'IHDR' ||
        data.readUInt32BE(16) < 1 ||
        data.readUInt32BE(20) < 1 ||
        data.readUInt32BE(16) > 512 ||
        data.readUInt32BE(20) > 512
    )
        throw new Error('Unsupported app icon.');
    return data;
}

/**
 * Persistent presentation cache. Icon hashes are independent from permission fingerprints:
 * replacing an icon never grants or resets permissions. Only authenticated peers may update it.
 */
export class ExternalAppIconCache {
    /** The records value. */
    private records: Record<string, ExternalAppIcon> = Object.create(null);
    /** The writes value. */
    private writes: Promise<void> = Promise.resolve();
    /** Whether the ready option is enabled. */
    private ready?: Promise<void>;
    /**
     * @param file Private cache JSON path scoped to this host and connection mode.
     * @param normalize Decode pixels and return a metadata-free PNG (native image decoder in production).
     */
    constructor(
        private readonly file: string,
        private readonly normalize: (bytes: Buffer) => Buffer,
    ) {}

    /** Loads bounded, validated cached images; damaged cache entries are requested again. */
    load(): Promise<void> {
        return (this.ready ??= (async () => {
            try {
                if ((await stat(this.file)).size > 4 * 1024 * 1024) return;
                const text = await readFile(this.file, 'utf8');
                if (text.length > 4 * 1024 * 1024) return;
                const records = JSON.parse(text);
                if (
                    !records ||
                    typeof records !== 'object' ||
                    Array.isArray(records)
                )
                    return;
                for (const [id, value] of Object.entries(records).slice(
                    0,
                    64,
                )) {
                    const icon = value as ExternalAppIcon;
                    try {
                        if (!/^[a-f0-9]{64}$/.test(icon.hash)) continue;
                        const png = this.normalize(pngBytes(icon.png)).toString(
                            'base64',
                        );
                        pngBytes(png);
                        this.records[id] = { hash: icon.hash, png };
                    } catch {
                        /* Invalid cache entries fall back to the app's initial. */
                    }
                }
            } catch {
                /* Missing/corrupt presentation cache does not block app startup. */
            }
        })());
    }

    /** Returns safe local data URLs for Renderer, without native paths or network requests. */
    snapshot(): Readonly<Record<string, string>> {
        return Object.fromEntries(
            Object.entries(this.records).map(([id, icon]) => [
                id,
                `data:image/png;base64,${icon.png}`,
            ]),
        );
    }

    /** Compares a startup announcement. Null explicitly removes an icon; omission keeps legacy clients compatible. */
    async needs(appId: string, hash: unknown): Promise<boolean> {
        await this.load();
        if (hash === null) {
            await this.remove(appId);
            return false;
        }
        return (
            typeof hash === 'string' &&
            /^[a-f0-9]{64}$/.test(hash) &&
            this.records[appId]?.hash !== hash
        );
    }

    /** Verifies the announced digest and raster bytes before replacing the durable cache. */
    async update(appId: string, icon: ExternalAppIcon): Promise<void> {
        await this.load();
        const data = pngBytes(icon.png);
        if (createHash('sha256').update(data).digest('hex') !== icon.hash)
            throw new Error('App icon hash mismatch.');
        const png = this.normalize(data).toString('base64');
        pngBytes(png);
        this.records[appId] = { hash: icon.hash, png };
        await this.persist();
    }

    /** Drops cached presentation on unregister or explicit icon removal. */
    async remove(appId: string): Promise<void> {
        await this.load();
        if (!Object.hasOwn(this.records, appId)) return;
        delete this.records[appId];
        await this.persist();
    }

    /** Serializes atomic cache writes; no resource data or credentials are included. */
    private persist(): Promise<void> {
        const text = JSON.stringify(this.records);
        const next = this.writes.then(async () => {
            await mkdir(path.dirname(this.file), {
                recursive: true,
                mode: 0o700,
            });
            const temporary = `${this.file}.${randomUUID()}.tmp`;
            try {
                await writeFile(temporary, text, { mode: 0o600, flag: 'wx' });
                await rename(temporary, this.file);
            } finally {
                await rm(temporary, { force: true });
            }
        });
        this.writes = next.catch(() => {});
        return next;
    }
}
