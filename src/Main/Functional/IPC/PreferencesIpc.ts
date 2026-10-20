import { app } from 'electron';
import { IPC_CHANNELS, type PreferencePatch } from '../../../Common/IPC';
import type { BundleDevelopmentManager } from '../../Manager/BundleDevelopmentManager';
import type { LoggingManager } from '../../Manager/LoggingManager';
import type { PreferenceManager } from '../../Manager/PreferenceManager';
import type { ProviderManager } from '../../Manager/ProviderManager';
import type { ShortcutManager } from '../../Manager/ShortcutManager';
import type { UpdateManager } from '../../Manager/UpdateManager';
import { type ViewerRuntime } from '../Viewer/ViewerRuntime';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';
import {
    isGraphicsRestartConfirmed,
    readRequestedGraphicsMode,
    requireAppTheme,
} from './Validation';

/** Allows the persisted preference response to reach Renderer before relaunch. */
const APPLICATION_RELAUNCH_DELAY_MS = 200;

/** Dependencies used by preferences IPC only. */
interface PreferencesIpcDependencies {
    /** Application-scoped preferences dependency. */
    readonly preferences: PreferenceManager;
    /** Application-scoped viewerRuntime dependency. */
    readonly viewerRuntime: Pick<
        ViewerRuntime,
        'diagnostics' | 'pip' | 'viewer' | 'windows'
    >;
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
    viewerRuntime,
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
        ipc.handle(IPC_CHANNELS.preferences.get, () => preferenceManager.get());
        ipc.handle(
            IPC_CHANNELS.preferences.previewTheme,
            (_event, theme: unknown) => {
                viewerRuntime.viewer.setAppTheme(requireAppTheme(theme));
            },
        );
        ipc.handle(
            IPC_CHANNELS.preferences.update,
            async (_event, patch: unknown, options: unknown) => {
                const currentGraphicsMode =
                    preferenceManager.get().graphicsMode;
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
                        ? {
                              ...patch,
                              appWindow:
                                  viewerRuntime.windows.normalizeAppWindowPreference(
                                      (patch as PreferencePatch).appWindow!,
                                  ),
                          }
                        : patch,
                );
                if (graphicsModeChanged) {
                    scheduleApplicationRelaunch();
                    return preferences;
                }

                viewerRuntime.viewer.setAppLocale(
                    preferences.appLocale,
                    app.getLocale(),
                );
                viewerRuntime.viewer.setAppTheme(preferences.appTheme);
                await viewerRuntime.windows.applyAppWindowPreference(
                    preferences.appWindow,
                );
                viewerRuntime.windows.setAlwaysOnTop(preferences.alwaysOnTop);
                viewerRuntime.viewer.setMenuDismissBehavior(
                    preferences.closeMenuOnEscape,
                    preferences.closeMenuOnOutsideClick,
                );
                // The startup checkbox is persisted for the next app launch. Saving it
                // must not unexpectedly open DevTools in the current session.
                viewerRuntime.diagnostics.setDevToolsMode(
                    preferences.devToolsMode,
                );
                viewerRuntime.pip.setPictureInPicturePlacement(
                    preferences.pictureInPicturePlacement,
                );
                viewerRuntime.pip.setPictureInPictureSize(
                    preferences.pictureInPictureSize,
                );
                viewerRuntime.pip.setPictureInPicturePortraitSize(
                    preferences.pictureInPicturePortraitSize,
                );
                await viewerRuntime.pip.setPictureInPictureSubtitleScale(
                    preferences.pictureInPictureSubtitleScale,
                );
                logging.configure(preferences.logLevel, preferences.logSources);
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
