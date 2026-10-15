import { net } from 'electron';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type ExternalDownloaderPlatform } from '../../Common/Download';

/** Defines the shared external downloader app name constant. */
export const EXTERNAL_DOWNLOADER_APP_NAME = 'YT Section Downloader';
/** Defines the shared external downloader releases page constant. */
export const EXTERNAL_DOWNLOADER_RELEASES_PAGE =
    'https://github.com/fabyday/yt-downloader/releases';
/** Describes the external downloader release manifest contract. */
export interface ExternalDownloaderReleaseManifest {
    /** The version value. */
    readonly version: string;
    /** The artifacts value. */
    readonly artifacts: ExternalDownloaderReleaseArtifact[];
}

/** Describes the external downloader release artifact contract. */
export interface ExternalDownloaderReleaseArtifact {
    /** The platform value. */
    readonly platform: ExternalDownloaderPlatform;
    /** The arch value. */
    readonly arch: string;
    /** The kind value. */
    readonly kind: 'dmg' | 'zip' | 'exe';
    /** The URL value. */
    readonly url: string;
    /** The sha256 value. */
    readonly sha256: string;
}

/** Describes the installed external downloader app contract. */
export interface InstalledExternalDownloaderApp {
    /** The path value. */
    readonly path?: string;
    /** The version value. */
    readonly version?: string;
}

/** Result of preparing or launching the platform's companion installer. */
export interface ExternalDownloaderInstallation {
    /** Whether completion is delegated to an external installer. */
    readonly installerStarted: boolean;
    /** Installed version when installation completed in process. */
    readonly version?: string;
}

/** Runs the external downloader command. */
export function runExternalDownloaderCommand(
    command: string,
    args: readonly string[],
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk: string) => {
            stderr += chunk;
        });
        child.once('error', reject);
        child.once('close', (code) => {
            if (code === 0) resolve(stdout);
            else {
                reject(
                    new Error(
                        `${path.basename(command)} exited with code ${code}: ${stderr.trim()}`,
                    ),
                );
            }
        });
    });
}

/** Performs the download verified artifact operation. */
export async function downloadVerifiedArtifact(
    artifact: ExternalDownloaderReleaseArtifact,
    destination: string,
): Promise<void> {
    const response = await net.fetch(artifact.url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok || !response.body) {
        throw new Error(`YT Downloader download failed (${response.status}).`);
    }
    const body = Readable.fromWeb(
        response.body as unknown as import('node:stream/web').ReadableStream,
    );
    await pipeline(body, createWriteStream(destination, { mode: 0o600 }));
    const actualHash = await sha256(destination);
    if (actualHash !== artifact.sha256.toLowerCase()) {
        await fs.rm(destination, { force: true });
        throw new Error('YT Downloader SHA-256 verification failed.');
    }
}

/** Performs the sha256 operation. */
export async function sha256(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) hash.update(chunk);
    return hash.digest('hex');
}

/** Performs the require HTTPS URL operation. */
export function requireHttpsUrl(value: string, label: string): void {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${label} URL is invalid.`);
    }
    if (url.protocol !== 'https:')
        throw new Error(`${label} URL must use HTTPS.`);
}

/** Performs the require release artifact URL operation. */
export function requireReleaseArtifactUrl(value: string): void {
    requireHttpsUrl(value, 'Release artifact');
    const url = new URL(value);
    if (
        url.hostname !== 'github.com' ||
        !url.pathname.startsWith('/fabyday/yt-downloader/releases/')
    ) {
        throw new Error(
            'Release artifact must belong to fabyday/yt-downloader.',
        );
    }
}

/** Determines whether the file condition applies. */
export async function isFile(filePath: string): Promise<boolean> {
    try {
        return (await fs.stat(filePath)).isFile();
    } catch {
        return false;
    }
}

/** Performs the path exists operation. */
export async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}
