import type { ExternalAppManager } from '../../Manager/ExternalAppManager';
import { YOUTUBE_DOWNLOADER_APP_ID } from '../ExternalApps/YouTubeDownloaderAdapter';
import { openProviderDownload } from '../ExternalApps/ProviderDownloads';
import { IPC_CHANNELS } from '../../../Common/IPC';
import type { YouTubeDownloader } from '../ExternalApps/YouTubeDownloader';
import type { ProviderManager } from '../../Manager/ProviderManager';
import { type ViewerRuntime } from '../Viewer/ViewerRuntime';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';
import { isExternalDownloaderUrl } from './Validation';

/** Dependencies used by downloads IPC only. */
interface DownloadsIpcDependencies {
    /** Generic adapter registration and permission boundary. */
    readonly externalApps?: ExternalAppManager;
    /** Application-scoped downloads dependency. */
    readonly downloads: YouTubeDownloader;
    /** Application-scoped viewerRuntime dependency. */
    readonly viewerRuntime: Pick<ViewerRuntime, 'video' | 'viewer'>;
    /** Application-scoped sites dependency. */
    readonly sites: ProviderManager;
}

/** Connects downloads requests and events to their application services. */
export function connectDownloadsIpc({
    downloads,
    externalApps,
    viewerRuntime,
    sites,
}: DownloadsIpcDependencies): DisposeIpc {
    /** Manual panel calls use the same consent boundary as Provider-originated calls. */
    const open = async (url: unknown) => {
        if (
            typeof url !== 'string' ||
            !isExternalDownloaderUrl(url) ||
            !externalApps
        )
            throw new TypeError(
                'A safe HTTPS source URL and external app registry are required.',
            );
        const address = sites.resolveAddress(url);
        const result = address
            ? (await sites.requestDownload(address.siteId, address.url)).result
            : await externalApps.request(
                  YOUTUBE_DOWNLOADER_APP_ID,
                  { action: 'open' },
                  {
                      url,
                      isActive: () => true,
                      readCookies: async () => [],
                  },
              );
        if (!result.accepted && result.code !== 'unavailable')
            throw new Error(
                `External application request failed: ${result.code}`,
            );
        return {
            opened: result.accepted,
            requestId: result.accepted ? result.requestId : undefined,
            status: await downloads.getStatus(),
        };
    };
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.downloads.openYouTube,
            async (_event, url: unknown) => {
                if (typeof url !== 'string' || !isExternalDownloaderUrl(url)) {
                    throw new TypeError('A safe HTTPS source URL is required.');
                }
                return openProviderDownload(
                    sites,
                    viewerRuntime,
                    'kawaikara.youtube',
                    url,
                );
            },
        );
        ipc.handle(IPC_CHANNELS.downloads.status, () => downloads.getStatus());
        ipc.handle(
            IPC_CHANNELS.downloads.install,
            async (_event, url: unknown) => {
                if (
                    url !== undefined &&
                    url !== '' &&
                    (typeof url !== 'string' || !isExternalDownloaderUrl(url))
                )
                    throw new TypeError('A safe HTTPS source URL is required.');
                // Installation never bypasses app registration by auto-opening the source itself.
                const result = await downloads.install();
                return !result.canceled &&
                    result.status.installed &&
                    typeof url === 'string' &&
                    url
                    ? { ...result, ...(await open(url)) }
                    : result;
            },
        );
        ipc.handle(IPC_CHANNELS.downloads.open, (_event, url: unknown) =>
            open(url),
        );
        ipc.handle(IPC_CHANNELS.downloads.openReleasePage, () =>
            downloads.openReleasePage(),
        );
    });
}
