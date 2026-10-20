import { app, clipboard } from 'electron';
import { KAWAIKARA_SITE_API_VERSION } from '@kawaikara/site-api';
import { IPC_CHANNELS } from '../../../Common/IPC';
import { requireAppLocale } from './Validation';
import { getRendererMessages } from '../Localization/RendererMessages';
import { getOperatingSystemLabel } from '../../Platform/Information';
import {
    getDefaultVideoAppCapability,
    openDefaultVideoAppSettings,
} from '../../Platform/DefaultVideoApp';
import { requireSettingsSender } from './SettingsSender';
import type { LoggingManager } from '../../Manager/LoggingManager';
import type { ApplicationDataManager } from '../../Manager/ApplicationDataManager';
import type { PreferenceManager } from '../../Manager/PreferenceManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Maximum plain-text clipboard payload accepted from app Views. */
const MAX_CLIPBOARD_TEXT_LENGTH = 16_384;

/** Dependencies used by application IPC only. */
interface ApplicationIpcDependencies {
    /** Application-scoped logging dependency. */
    readonly logging: LoggingManager;
    /** Application-scoped data dependency. */
    readonly data: ApplicationDataManager;
    /** Application-scoped preferences dependency. */
    readonly preferences: PreferenceManager;
}

/** Connects application requests and events to their application services. */
export function connectApplicationIpc({
    logging,
    data,
    preferences,
}: ApplicationIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(IPC_CHANNELS.application.info, () => ({
            metadata: logging.getMetadata(),
            canConfigureDefaultVideoApp: getDefaultVideoAppCapability(),
            dataLocation: data.getLocation(),
            name: app.getName(),
            version: app.getVersion(),
            siteApiVersion: KAWAIKARA_SITE_API_VERSION,
            electronVersion: process.versions.electron,
            chromeVersion: process.versions.chrome,
            platform: getOperatingSystemLabel(),
            arch: process.arch,
            buildChannel: __KAWAIKARA_BUILD_CHANNEL__,
            updateChannelLocked: true,
        }));
        ipc.handle(
            IPC_CHANNELS.application.messages,
            (_event, locale: unknown) => {
                const requestedLocale =
                    locale === undefined
                        ? preferences.get().appLocale
                        : requireAppLocale(locale);
                return getRendererMessages(requestedLocale, app.getLocale());
            },
        );
        ipc.handle(
            IPC_CHANNELS.application.openDefaultVideoAppSettings,
            async (event, locale: unknown) => {
                requireSettingsSender(event);
                const copy = getRendererMessages(
                    requireAppLocale(locale),
                    app.getLocale(),
                ).app.defaultVideoApp;
                try {
                    await openDefaultVideoAppSettings();
                } catch (reason) {
                    logging
                        .getLogger('ipcManager', 'defaultVideoApp')
                        .warn('Could not open default app settings.', reason);
                    throw new Error(copy.failed);
                }
            },
        );
        ipc.handle(
            IPC_CHANNELS.application.copyText,
            (_event, value: unknown) => {
                if (typeof value !== 'string' || value.length > MAX_CLIPBOARD_TEXT_LENGTH) {
                    throw new TypeError(
                        'Clipboard text must be a valid string.',
                    );
                }
                clipboard.writeText(value);
            },
        );
    });
}
