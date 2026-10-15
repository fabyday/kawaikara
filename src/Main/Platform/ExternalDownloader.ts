import * as darwin from './Darwin/ExternalDownloader';
import * as linux from './Linux/ExternalDownloader';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/ExternalDownloader';
import { net } from 'electron';
import {
    isExternalDownloaderSourceUrl,
    type ExternalDownloaderCallbackDescriptor,
    type ExternalDownloaderPlatform,
} from '../../Common/Download';
import type {
    ExternalDownloaderInstallation,
    ExternalDownloaderReleaseArtifact,
    ExternalDownloaderReleaseManifest,
} from './ExternalDownloaderSupport';
import {
    EXTERNAL_DOWNLOADER_RELEASES_PAGE,
    requireHttpsUrl,
    requireReleaseArtifactUrl,
} from './ExternalDownloaderSupport';
export {
    EXTERNAL_DOWNLOADER_APP_NAME,
    EXTERNAL_DOWNLOADER_RELEASES_PAGE,
} from './ExternalDownloaderSupport';
export type {
    ExternalDownloaderInstallation,
    ExternalDownloaderReleaseArtifact,
    ExternalDownloaderReleaseManifest,
    InstalledExternalDownloaderApp,
} from './ExternalDownloaderSupport';
/** Companion protocol understood by every supported native launcher. */
const PROTOCOL = 'yt-downloader';
/** Default companion release manifest location. */
const DEFAULT_MANIFEST_URL = `${EXTERNAL_DOWNLOADER_RELEASES_PAGE}/latest/download/release-manifest.json`;
/** Manifest formats accepted before native artifact selection. */
const SUPPORTED_ARTIFACT_KINDS = new Set(['dmg', 'zip', 'exe']);

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Discover the installed companion on this system. */
export const findInstalledExternalDownloaderApp =
    implementation.findInstalledExternalDownloaderApp;

/** Return the native companion installation mechanism. */
export const getExternalDownloaderInstallMethod =
    implementation.getExternalDownloaderInstallMethod;

/** Launch the companion with a prepared deep link. */
export const launchExternalDownloader = implementation.launchExternalDownloader;

/** Performs the fetch external downloader release manifest operation. */
export async function fetchExternalDownloaderReleaseManifest(): Promise<ExternalDownloaderReleaseManifest> {
    const manifestUrl =
        process.env.YT_DOWNLOADER_RELEASE_MANIFEST_URL?.trim() ||
        DEFAULT_MANIFEST_URL;
    requireHttpsUrl(manifestUrl, 'Release manifest');
    const response = await net.fetch(manifestUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
        throw new Error(
            `YT Downloader release manifest request failed (${response.status}).`,
        );
    }
    return parseManifest(await response.json());
}

/** Selects the external downloader artifact. */
export function selectExternalDownloaderArtifact(
    manifest: ExternalDownloaderReleaseManifest,
    arch: string = process.arch,
): ExternalDownloaderReleaseArtifact {
    const { platform, artifactKinds: preferredKinds } = implementation;
    for (const kind of preferredKinds) {
        const artifact = manifest.artifacts.find(
            (candidate) =>
                candidate.platform === platform &&
                (candidate.arch === arch || candidate.arch === 'universal') &&
                candidate.kind === kind,
        );
        if (artifact) return artifact;
    }
    throw new Error(
        `No YT Downloader release is available for ${platform}/${arch}.`,
    );
}

/** Creates the external downloader deep link. */
export function createExternalDownloaderDeepLink(
    sourceUrl: string,
    callback?: ExternalDownloaderCallbackDescriptor,
): string {
    const deepLink = new URL(`${PROTOCOL}://open`);
    deepLink.searchParams.set('url', sourceUrl);
    if (callback) {
        deepLink.searchParams.set('requestId', callback.requestId);
        deepLink.searchParams.set('callback', callback.callbackUrl);
        deepLink.searchParams.set('token', callback.token);
    }
    return deepLink.toString();
}

/** Requires a safe transport URL without deciding whether the external app supports it. */
export function requireExternalDownloaderSourceUrl(value: unknown): string {
    if (typeof value !== 'string')
        throw new TypeError('A source URL is required.');
    if (!isExternalDownloaderSourceUrl(value)) {
        throw new TypeError('A safe HTTPS source URL is required.');
    }
    return new URL(value).toString();
}

/** Parses the manifest. */
function parseManifest(value: unknown): ExternalDownloaderReleaseManifest {
    if (!value || typeof value !== 'object') {
        throw new Error('YT Downloader release manifest is invalid.');
    }
    const candidate = value as Partial<ExternalDownloaderReleaseManifest>;
    if (
        typeof candidate.version !== 'string' ||
        !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(candidate.version) ||
        !Array.isArray(candidate.artifacts)
    ) {
        throw new Error('YT Downloader release manifest is invalid.');
    }
    const artifacts = candidate.artifacts.map((artifact) => {
        if (!artifact || typeof artifact !== 'object') {
            throw new Error('YT Downloader release artifact is invalid.');
        }
        const item = artifact as Partial<ExternalDownloaderReleaseArtifact>;
        if (
            !['darwin', 'win32', 'linux'].includes(item.platform ?? '') ||
            typeof item.arch !== 'string' ||
            !SUPPORTED_ARTIFACT_KINDS.has(item.kind ?? '') ||
            typeof item.url !== 'string' ||
            typeof item.sha256 !== 'string' ||
            !/^[a-fA-F0-9]{64}$/.test(item.sha256)
        ) {
            throw new Error('YT Downloader release artifact is invalid.');
        }
        requireReleaseArtifactUrl(item.url);
        return item as ExternalDownloaderReleaseArtifact;
    });
    return {
        /** The version value. */
        version: candidate.version,
        /** The artifacts value. */
        artifacts,
    };
}

/** Native target included in companion status diagnostics. */
export function getExternalDownloaderPlatform(): ExternalDownloaderPlatform {
    return implementation.platform;
}

/** Reject mismatched artifacts before downloading or launching a native installer. */
export async function installExternalDownloaderArtifact(
    manifest: ExternalDownloaderReleaseManifest,
    artifact: ExternalDownloaderReleaseArtifact,
): Promise<ExternalDownloaderInstallation> {
    if (
        artifact.platform !== implementation.platform ||
        !implementation.artifactKinds.includes(artifact.kind)
    ) {
        throw new Error(
            'Automatic downloader installation is unsupported for this artifact on this platform.',
        );
    }
    return implementation.installExternalDownloaderArtifact(manifest, artifact);
}
