import { IPC_CHANNELS } from '../../../Common/IPC';
import type { ProviderManager } from '../../Manager/ProviderManager';
import { type ViewerRuntime } from '../Viewer/ViewerRuntime';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by provider IPC only. */
interface ProviderIpcDependencies {
    /** Application-scoped sites dependency. */
    readonly sites: ProviderManager;
    /** Application-scoped viewerRuntime dependency. */
    readonly viewerRuntime: Pick<ViewerRuntime, 'site' | 'viewer'>;
}

/** Connects provider requests and events to their application services. */
export function connectProviderIpc({
    sites,
    viewerRuntime,
}: ProviderIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(IPC_CHANNELS.sites.list, () => sites.listMenuItems());
        ipc.handle(IPC_CHANNELS.sites.currentAddress, () =>
            viewerRuntime.site.getCurrentSiteAddress(),
        );
        ipc.handle(IPC_CHANNELS.sites.navigationState, () =>
            viewerRuntime.site.getNavigationState(),
        );
        ipc.handle(IPC_CHANNELS.sites.goBack, () =>
            viewerRuntime.site.goBack(),
        );
        ipc.handle(IPC_CHANNELS.sites.goForward, () =>
            viewerRuntime.site.goForward(),
        );
        ipc.handle(IPC_CHANNELS.sites.open, async (_event, id: unknown) => {
            if (typeof id !== 'string') {
                throw new TypeError('Site id must be a string.');
            }
            viewerRuntime.viewer.hideOverlay();
            try {
                await sites.load(id);
            } catch (error) {
                // Keep the existing menu error/retry flow reachable after a failed switch.
                viewerRuntime.viewer.showOverlay();
                throw error;
            }
        });
        ipc.handle(
            IPC_CHANNELS.sites.openAddress,
            async (_event, value: unknown) => {
                if (typeof value !== 'string') {
                    throw new TypeError('Site address must be a string.');
                }
                const resolved = sites.resolveAddress(value);
                if (!resolved) return { status: 'unsupported' as const };
                viewerRuntime.viewer.hideOverlay();
                await sites.openUrl(resolved.siteId, resolved.url);
                return { status: 'opened' as const, siteId: resolved.siteId };
            },
        );
    });
}
