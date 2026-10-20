import { IPC_CHANNELS } from '../../../Common/IPC';
import type { ProviderManager } from '../../Manager/ProviderManager';
import type { WindowManager } from '../../Manager/WindowManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by provider IPC only. */
interface ProviderIpcDependencies {
    /** Application-scoped sites dependency. */
    readonly sites: ProviderManager;
    /** Application-scoped windows dependency. */
    readonly windows: WindowManager;
}

/** Connects provider requests and events to their application services. */
export function connectProviderIpc({
    sites,
    windows,
}: ProviderIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(IPC_CHANNELS.sites.list, () =>
            sites.listMenuItems(),
        );
        ipc.handle(IPC_CHANNELS.sites.currentAddress, () =>
            windows.getCurrentSiteAddress(),
        );
        ipc.handle(IPC_CHANNELS.sites.navigationState, () =>
            windows.getNavigationState(),
        );
        ipc.handle(IPC_CHANNELS.sites.goBack, () => windows.goBack());
        ipc.handle(IPC_CHANNELS.sites.goForward, () =>
            windows.goForward(),
        );
        ipc.handle(IPC_CHANNELS.sites.open, async (_event, id: unknown) => {
            if (typeof id !== 'string') {
                throw new TypeError('Site id must be a string.');
            }
            windows.hideOverlay();
            try {
                await sites.load(id);
            } catch (error) {
                // Keep the existing menu error/retry flow reachable after a failed switch.
                windows.showOverlay();
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
                windows.hideOverlay();
                await sites.openUrl(resolved.siteId, resolved.url);
                return { status: 'opened' as const, siteId: resolved.siteId };
            },
        );
    });
}
