import { rasterDimensions } from './RasterBounds';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nativeImage } from 'electron';
import type { ExternalAppDistribution } from '../../../../Common/ExternalAppDistribution';
import { readJsonFile } from '../../Files/JsonFile';
import { parseDistribution, distributionResourceUrl } from './Descriptor';
import { readPublicResource } from './PublicResource';

/** Cached public presentation; intentionally separate from authenticated handshake icons and permissions. */
export interface DistributionRecord {
    /** Revalidated descriptor. */
    readonly descriptor: ExternalAppDistribution;
    /** Locally normalized PNG data URL. */
    readonly icon?: string;
    /** Whether the network failed and a verified cached document was used. */
    readonly cached: boolean;
}
/** Decodes raster images and removes metadata before returning a renderer-safe PNG. */
export function normalizeDistributionIcon(bytes: Buffer): string {
    if (bytes.length > 512 * 1024)
        throw new Error('App icon exceeds size limit.');
    const [width, height] = rasterDimensions(bytes);
    if (width < 1 || height < 1 || width > 2048 || height > 2048)
        throw new Error('Unsupported app icon dimensions.');
    const image = nativeImage.createFromBuffer(bytes);
    const size = image.getSize();
    if (image.isEmpty() || size.width > 2048 || size.height > 2048)
        throw new Error('Unsupported app icon dimensions.');
    const normalized = image
        .resize({ width: Math.min(256, size.width) })
        .toPNG();
    if (normalized.length > 512 * 1024)
        throw new Error('Normalized icon exceeds size limit.');
    return `data:image/png;base64,${normalized.toString('base64')}`;
}
/** Loads a small, source-scoped cache and never turns presentation into authorization. */
export class DistributionRepository {
    /**
     * @param directory Private app-owned cache directory, independent of registration state.
     * @param read Injectable bounded reader; production uses credential-free public HTTPS.
     * @param testOrigin Optional explicit loopback fixture origin, with a separate cache directory.
     */
    constructor(
        private readonly directory: string,
        private readonly read = readPublicResource,
        /** Explicit process-local fixture origin; absent in normal runs. */
        private readonly testOrigin?: string,
    ) {}
    /** Fetches a descriptor/icon; valid cached metadata remains usable when offline. */
    async load(
        source: string,
        expectedId?: string,
    ): Promise<DistributionRecord> {
        const sourceUrl = distributionResourceUrl(
            source,
            undefined,
            this.testOrigin,
        );
        const filename = path.join(
            this.directory,
            createHash('sha256').update(sourceUrl).digest('hex') + '.json',
        );
        let previous: DistributionRecord | undefined;
        try {
            const value = (await readJsonFile(filename, {
                maxBytes: 1024 * 1024,
            })) as { descriptor?: unknown; icon?: unknown };
            const descriptor = parseDistribution(
                value.descriptor,
                sourceUrl,
                expectedId,
                this.testOrigin,
            );
            const icon =
                typeof value.icon === 'string' &&
                value.icon.startsWith('data:image/png;base64,')
                    ? normalizeDistributionIcon(
                          Buffer.from(value.icon.slice(22), 'base64'),
                      )
                    : undefined;
            previous = { descriptor, icon, cached: true };
        } catch {
            /* Missing or corrupt cache is replaceable presentation data. */
        }
        let descriptor: ExternalAppDistribution;
        try {
            descriptor = parseDistribution(
                JSON.parse(
                    (
                        await this.read(sourceUrl, 256 * 1024, this.testOrigin)
                    ).toString('utf8'),
                ),
                sourceUrl,
                expectedId,
                this.testOrigin,
            );
        } catch (error) {
            if (previous) return previous;
            throw error;
        }
        let icon =
            previous?.descriptor.id === descriptor.id &&
            previous.descriptor.icon === descriptor.icon
                ? previous.icon
                : undefined;
        if (descriptor.icon) {
            try {
                icon = normalizeDistributionIcon(
                    await this.read(
                        descriptor.icon,
                        512 * 1024,
                        this.testOrigin,
                    ),
                );
            } catch {
                /* Icon failures do not prevent instructions or installation. */
            }
        } else icon = undefined;
        const record = { descriptor, icon, cached: false };
        try {
            await mkdir(this.directory, { recursive: true, mode: 0o700 });
            const temporary = `${filename}.${randomUUID()}.tmp`;
            try {
                await writeFile(temporary, JSON.stringify(record), {
                    mode: 0o600,
                    flag: 'wx',
                });
                await rename(temporary, filename);
            } finally {
                await rm(temporary, { force: true });
            }
            // Bound disk usage even when many unrelated URLs are inspected.
            const entries = (await readdir(this.directory)).filter((name) =>
                /^[a-f0-9]{64}\.json$/.test(name),
            );
            for (const name of entries
                .filter((name) => path.join(this.directory, name) !== filename)
                .slice(31))
                await rm(path.join(this.directory, name), { force: true });
        } catch {
            /* Read-only or unavailable cache must not block a valid preview. */
        }
        return record;
    }
}
