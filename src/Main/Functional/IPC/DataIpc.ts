import { app } from 'electron';
import { IPC_CHANNELS } from '../../../Common/IPC';
import { requireAppLocale, requireIdentifier, requirePathString } from './Validation';
import { getRendererMessages } from '../Localization/RendererMessages';
import { requireSettingsSender } from './SettingsSender';
import type { ApplicationDataManager } from '../../Manager/ApplicationDataManager';
import type { UpdateManager } from '../../Manager/UpdateManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by data IPC only. */
interface DataIpcDependencies {
    /** Application-scoped data dependency. */
    readonly data: ApplicationDataManager;
    /** Application-scoped updates dependency. */
    readonly updates: UpdateManager;
}

/** Connects data requests and events to their application services. */
export function connectDataIpc({
    data,
    updates,
}: DataIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.data.selectLocation,
            (event, locale: unknown) => {
                requireSettingsSender(event);
                return data.selectLocation(requireAppLocale(locale));
            },
        );
        ipc.handle(
            IPC_CHANNELS.data.changeLocation,
            (event, directory: unknown, locale: unknown) => {
                requireSettingsSender(event);
                const requestedLocale = requireAppLocale(locale);
                if (
                    ['downloading', 'preparing', 'installing'].includes(
                        updates.getState()?.phase ?? '',
                    )
                ) {
                    throw new Error(
                        getRendererMessages(
                            requestedLocale,
                            app.getLocale(),
                        ).app.appDataLocation.busy,
                    );
                }
                return data.changeLocation(
                    requirePathString(directory),
                    requestedLocale,
                );
            },
        );
        ipc.handle(
            IPC_CHANNELS.data.clearBrowserProfile,
            (_event, profileId: unknown, locale: unknown) =>
                data.clearBrowserProfile(
                    requireIdentifier(profileId, 'Browser profile'),
                    requireAppLocale(locale),
                ),
        );
        ipc.handle(
            IPC_CHANNELS.data.clearIsolatedSite,
            (_event, siteId: unknown, locale: unknown) =>
                data.clearIsolatedSite(
                    requireIdentifier(siteId, 'Site'),
                    requireAppLocale(locale),
                ),
        );
        ipc.handle(
            IPC_CHANNELS.data.clearApplicationCache,
            (_event, locale: unknown) =>
                data.clearApplicationCache(requireAppLocale(locale)),
        );
        ipc.handle(
            IPC_CHANNELS.data.clearAllBrowserProfiles,
            (_event, locale: unknown) =>
                data.clearAllBrowserProfiles(requireAppLocale(locale)),
        );
        ipc.handle(
            IPC_CHANNELS.data.resetApplication,
            (_event, locale: unknown) =>
                data.resetApplication(requireAppLocale(locale)),
        );
    });
}
