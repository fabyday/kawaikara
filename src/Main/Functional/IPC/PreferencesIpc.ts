import { app } from 'electron';
import { IPC_CHANNELS, type PreferencePatch } from '../../../Common/IPC';
import {
    isGraphicsRestartConfirmed,
    readRequestedGraphicsMode,
    requireAppTheme,
} from './Validation';
import type { PreferenceManager } from '../../Manager/PreferenceManager';
import type { WindowManager } from '../../Manager/WindowManager';
import type { LoggingManager } from '../../Manager/LoggingManager';
import type { ShortcutManager } from '../../Manager/ShortcutManager';
import type { ProviderManager } from '../../Manager/ProviderManager';
import type { UpdateManager } from '../../Manager/UpdateManager';
import type { BundleDevelopmentManager } from '../../Manager/BundleDevelopmentManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Allows the persisted preference response to reach Renderer before relaunch. */
const APPLICATION_RELAUNCH_DELAY_MS = 200;

/** Dependencies used by preferences IPC only. */
interface PreferencesIpcDependencies {
    /** Application-scoped preferences dependency. */
    readonly preferences: PreferenceManager;
    /** Application-scoped windows dependency. */
    readonly windows: WindowManager;
    /** Application-scoped logging dependency. */
    readonly logging: LoggingManager;
    /** Application-scoped shortcuts dependency. */
    readonly shortcuts: ShortcutManager;
    /** Application-scoped sites dependency. */
    readonly sites: ProviderManager;
    /** Application-scoped updates dependency. */
    readonly updates: UpdateManager;
    /** Application-scoped development dependency. */
    readonly development: BundleDevelopmentManager;
}

/** Connects preferences requests and events to their application services. */
export function connectPreferencesIpc({
    preferences: preferenceManager,
    windows,
    logging,
    shortcuts,
    sites,
    updates,
    development,
}: PreferencesIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        let relaunchTimer: ReturnType<typeof setTimeout> | undefined;
        ipc.addCleanup(() => {
            if (relaunchTimer !== undefined) clearTimeout(relaunchTimer);
        });
        /** Schedules one restart after preferences have been persisted. */
        const scheduleApplicationRelaunch = (): void => {
            if (relaunchTimer !== undefined) return;
            relaunchTimer = setTimeout(() => {
                app.relaunch();
                app.quit();
            }, APPLICATION_RELAUNCH_DELAY_MS);
        };
        ipc.handle(IPC_CHANNELS.preferences.get, () =>
            preferenceManager.get(),
        );
        ipc.handle(
            IPC_CHANNELS.preferences.previewTheme,
            (_event, theme: unknown) => {
                windows.setAppTheme(requireAppTheme(theme));
            },
        );
        ipc.handle(
            IPC_CHANNELS.preferences.update,
            async (_event, patch: unknown, options: unknown) => {
                const currentGraphicsMode = preferenceManager.get().graphicsMode;
                const requestedGraphicsMode = readRequestedGraphicsMode(patch);
                const graphicsModeChanged =
                    requestedGraphicsMode !== undefined &&
                    requestedGraphicsMode !== currentGraphicsMode;
                if (
                    graphicsModeChanged &&
                    !isGraphicsRestartConfirmed(options)
                ) {
                    throw new Error(
                        'Changing the Electron graphics mode requires an application restart confirmation.',
                    );
                }

                const preferences = await preferenceManager.update(
                    patch && typeof patch === 'object' && 'appWindow' in patch
                        ? { ...patch, appWindow: windows.normalizeAppWindowPreference(
                            (patch as PreferencePatch).appWindow!,
                        ) } : patch,
                );
                if (graphicsModeChanged) {
                    scheduleApplicationRelaunch();
                    return preferences;
                }

                windows.setAppLocale(
                    preferences.appLocale,
                    app.getLocale(),
                );
                windows.setAppTheme(preferences.appTheme);
                await windows.applyAppWindowPreference(preferences.appWindow);
                windows.setAlwaysOnTop(preferences.alwaysOnTop);
                windows.setMenuDismissBehavior(
                    preferences.closeMenuOnEscape,
                    preferences.closeMenuOnOutsideClick,
                );
                // The startup checkbox is persisted for the next app launch. Saving it
                // must not unexpectedly open DevTools in the current session.
                windows.setDevToolsMode(preferences.devToolsMode);
                windows.setPictureInPicturePlacement(
                    preferences.pictureInPicturePlacement,
                );
                windows.setPictureInPictureSize(
                    preferences.pictureInPictureSize,
                );
                windows.setPictureInPicturePortraitSize(
                    preferences.pictureInPicturePortraitSize,
                );
                await windows.setPictureInPictureSubtitleScale(
                    preferences.pictureInPictureSubtitleScale,
                );
                logging.configure(
                    preferences.logLevel,
                    preferences.logSources,
                );
                shortcuts.refreshGlobalShortcut();
                await sites
                    .applyCurrentProviderSettings()
                    .catch((error: unknown) => {
                        // The preference is already durable. A simultaneous site navigation
                        // may destroy the old document before its live update is delivered;
                        // the Provider receives the stored value before its next load.
                        logging
                            .getLogger('ipcManager', 'updatePreferences')
                            .debug(
                                'Live Provider settings refresh was skipped.',
                                error,
                            );
                    });
                updates.configure(preferences);
                await development.configure(preferences);
                await sites.refreshCurrentBrowserProfile();
                return preferences;
            },
        );
    });
}
