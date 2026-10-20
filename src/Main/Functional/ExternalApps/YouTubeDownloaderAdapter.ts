import {
    KAWAI_DOWNLOADER_APP_ID,
    KAWAI_DOWNLOADER_APP_NAME,
} from '../../../Common/Download';
import type { ExternalAppAdapter } from './ExternalAppAdapter';
import type { YouTubeDownloader } from './YouTubeDownloader';

/** Companion identity selected by its consuming Providers. */
export const YOUTUBE_DOWNLOADER_APP_ID = KAWAI_DOWNLOADER_APP_ID;

/**
 * Offers the companion's own open action and optional cookie access to Kawaikara.
 * @param downloader - Native transport/install service; the registry has no downloader knowledge.
 * @returns App-owned adapter; URL access enables open, cookie access is independently optional.
 */
export function createYouTubeDownloaderAdapter(
    downloader: YouTubeDownloader,
): ExternalAppAdapter {
    const origins = [
        'https://www.youtube.com',
        'https://youtube.com',
        'https://m.youtube.com',
        'https://music.youtube.com',
        'https://youtu.be',
        'https://chzzk.naver.com',
    ];
    return {
        /** App-owned action and resource declarations reviewed before registration. */
        descriptor: {
            /** Host descriptor format, independent of application action semantics. */
            schemaVersion: 1,
            /** Stable adapter, action or permission identity within this declaration. */
            id: YOUTUBE_DOWNLOADER_APP_ID,
            /** App-supplied display name, rendered as text in settings. */
            name: KAWAI_DOWNLOADER_APP_NAME,
            /** Adapter behavior revision included in the consent fingerprint. */
            revision: '2',
            /** Individually approvable resource requirements or required grant IDs. */
            permissions: [
                {
                    /** Stable adapter, action or permission identity within this declaration. */
                    id: 'source',
                    /** Kawaikara host operation protected by this permission. */
                    kind: 'resource.url',
                    /** Exact HTTPS origin scopes presented during permission review. */
                    origins,
                },
                {
                    /** Stable adapter, action or permission identity within this declaration. */
                    id: 'session',
                    /** Kawaikara host operation protected by this permission. */
                    kind: 'cookies.read',
                    /** Exact HTTPS origin scopes presented during permission review. */
                    origins,
                },
            ],
            /** App-owned functions, each enabled only by its required grants. */
            actions: [
                {
                    /** Stable adapter, action or permission identity within this declaration. */
                    id: 'open',
                    /** Individually approvable resource requirements or required grant IDs. */
                    permissions: ['source'],
                },
            ],
        },
        /** Checks installation state without using any protected host resource. */
        async discover() {
            const status = await downloader.getStatus();
            return status.installed
                ? {
                      /** Installed application version when exposed by native discovery. */
                      version: status.version,
                  }
                : undefined;
        },
        /** Validates the app-owned action and delegates protected resource access to the host. */
        async execute(request, host) {
            if (request.action !== 'open' || request.parameters !== undefined)
                return {
                    /** Whether the adapter accepted this function invocation. */
                    accepted: false,
                    /** Machine-readable reason the invocation was rejected. */
                    code: 'invalid-request',
                    /** Whether user action or restoring application availability may allow retry. */
                    recoverable: false,
                };
            const result = await downloader.open(host.getUrl('source'), host);
            return result.opened
                ? {
                      /** Whether the adapter accepted this function invocation. */
                      accepted: true,
                      /** Correlation identity for authenticated request-scoped callbacks. */
                      requestId: result.requestId,
                  }
                : {
                      /** Whether the adapter accepted this function invocation. */
                      accepted: false,
                      /** Machine-readable reason the invocation was rejected. */
                      code: 'unavailable',
                      /** Whether user action or restoring application availability may allow retry. */
                      recoverable: true,
                  };
        },
    };
}
