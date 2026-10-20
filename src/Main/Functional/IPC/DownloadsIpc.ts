import { IPC_CHANNELS } from '../../../Common/IPC';
import { isExternalDownloaderUrl } from './Validation';
import type { ExternalDownloaderManager } from '../../Manager/ExternalDownloaderManager';
import type { WindowManager } from '../../Manager/WindowManager';
import type { ProviderManager } from '../../Manager/ProviderManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by downloads IPC only. */
interface DownloadsIpcDependencies {
    /** Application-scoped downloads dependency. */
    readonly downloads: ExternalDownloaderManager;
    /** Application-scoped windows dependency. */
    readonly windows: WindowManager;
    /** Application-scoped sites dependency. */
    readonly sites: ProviderManager;
}

/** Connects downloads requests and events to their application services. */
export function connectDownloadsIpc({
    downloads,
    windows,
    sites,
}: DownloadsIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.downloads.openYouTube,
            async (_event, url: unknown) => {
                if (typeof url !== 'string' || !isExternalDownloaderUrl(url)) {
                    throw new TypeError('A safe HTTPS source URL is required.');
                }
                const result = await downloads.open(url);
                if (!result.opened) {
                    windows.queueYouTubeDownloader(url);
                    windows.hideOverlay();
                    await sites.load('kawaikara.video');
                }
                return result;
            },
        );
        ipc.handle(IPC_CHANNELS.downloads.status, () =>
            downloads.getStatus(),
        );
        ipc.handle(IPC_CHANNELS.downloads.install, (_event, url: unknown) =>
            downloads.install(url),
        );
        ipc.handle(IPC_CHANNELS.downloads.open, (_event, url: unknown) =>
            downloads.open(url),
        );
        ipc.handle(IPC_CHANNELS.downloads.openReleasePage, () =>
            downloads.openReleasePage(),
        );
    });
}
