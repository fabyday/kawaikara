import { IPC_CHANNELS } from '../../../Common/IPC';
import type { ProviderManager } from '../../Manager/ProviderManager';
import type { ViewerRuntime } from '../Viewer/ViewerRuntime';
import { openProviderDownload } from '../ExternalApps/ProviderDownloads';
import { isExternalAppSourceUrl } from '../../../Common/ExternalAppResources';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';
import { requireSettingsSender } from './SettingsSender';

/** Routes source actions to their owning Provider without selecting an external app. */
export function connectProviderActionsIpc({ sites, viewerRuntime }: {
    /** Provider ownership, validation and action dispatch. */
    readonly sites: ProviderManager;
    /** Missing-app presentation owner. */
    readonly viewerRuntime: Pick<ViewerRuntime, 'viewer'>;
}): DisposeIpc {
    return registerIpcBindings(ipc => {
        ipc.handle(IPC_CHANNELS.providerActions.request, async (event, value: unknown, providerId?: unknown) => {
            if (typeof value !== 'string' || !isExternalAppSourceUrl(value)) throw new TypeError('Invalid source URL.');
            const address = sites.resolveAddress(value);
            if (!address || (providerId !== undefined && providerId !== address.siteId))
                throw new Error('No matching Provider action.');
            if (providerId !== undefined) requireSettingsSender(event);
            else if (event.senderFrame !== event.sender.mainFrame || !sites.resolveAddress(event.senderFrame.url) ||
                sites.resolveAddress(event.senderFrame.url)?.siteId !== address.siteId)
                throw new Error('Provider action sender mismatch.');
            return openProviderDownload(sites, viewerRuntime, address.siteId, address.url);
        });
    });
}
