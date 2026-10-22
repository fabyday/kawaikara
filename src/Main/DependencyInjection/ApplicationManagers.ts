import { useDevelopmentExternalApps } from '../Functional/ExternalApps/ConnectionMode';
import type { DevelopmentConnection } from '../Functional/ExternalApps/DevelopmentConnection';
import { readExternalAppCookies } from '../Functional/ExternalApps/ExternalAppCookies';
import path from 'node:path';
import { app } from 'electron';
import { ExternalAppPermissions } from '../Functional/ExternalApps/ExternalAppPermissions';
import { ExternalAppManager } from '../Manager/ExternalAppManager';
import { createYouTubeDownloaderAdapter } from '../Functional/ExternalApps/YouTubeDownloaderAdapter';
import { createApplicationShortcuts } from '../Functional/Shortcut/ApplicationShortcuts';
import type { StandardVideoLocation } from '../Functional/Video/VideoLibrary';
import {
    createViewerRuntime,
    type ViewerRuntime,
} from '../Functional/Viewer/ViewerRuntime';
import type { PictureInPictureManagerFactory } from '../Functional/Window/WindowRuntime';
import { ApplicationDataManager } from '../Manager/ApplicationDataManager';
import { BundleDevelopmentManager } from '../Manager/BundleDevelopmentManager';
import { BundleManager } from '../Manager/BundleManager';
import { ExternalBrowserManager } from '../Manager/ExternalBrowserManager';
import { YouTubeDownloader } from '../Functional/ExternalApps/YouTubeDownloader';
import { IpcManager } from '../Manager/IPCManager';
import { LoggingManager } from '../Manager/LoggingManager';
import { PreferenceManager } from '../Manager/PreferenceManager';
import { ProviderManager } from '../Manager/ProviderManager';
import type { ShortcutManager } from '../Manager/ShortcutManager';
import { SocialManager } from '../Manager/SocialManager';
import { UnifiedPictureInPictureManager } from '../Manager/UnifiedPictureInPictureManager';
import { UpdateManager } from '../Manager/UpdateManager';
import { VideoLibraryManager } from '../Manager/VideoLibraryManager';
import { createManagerToken, ManagerContainer } from './ManagerContainer';

/** Defines the shared manager tokens constant. */
export const MANAGER_TOKENS = {
    /** The bundles value. */
    bundles: createManagerToken<BundleManager>('BundleManager'),
    /** The data value. */
    data: createManagerToken<ApplicationDataManager>('ApplicationDataManager'),
    /** The development value. */
    development: createManagerToken<BundleDevelopmentManager>(
        'BundleDevelopmentManager',
    ),
    /** Shared social integrations and View-facing actions. */
    social: createManagerToken<SocialManager>('SocialManager'),
    /** Generic registry; app-specific adapters are wired here, never inside the manager. */
    externalApps: createManagerToken<ExternalAppManager>('ExternalAppManager'),
    /** Running development peers; production never starts this transport. */
    developmentConnection: createManagerToken<DevelopmentConnection>('DevelopmentConnection'),
    /** Shared installation UI and transport service for the companion adapter. */
    youtubeDownloader:
        createManagerToken<YouTubeDownloader>('YouTubeDownloader'),
    /** The external browser value. */
    externalBrowser: createManagerToken<ExternalBrowserManager>(
        'ExternalBrowserManager',
    ),
    /** The IPC value. */
    ipc: createManagerToken<IpcManager>('IpcManager'),
    /** The logging value. */
    logging: createManagerToken<LoggingManager>('LoggingManager'),
    /** The picture in picture factory value. */
    pictureInPictureFactory: createManagerToken<PictureInPictureManagerFactory>(
        'PictureInPictureManagerFactory',
    ),
    /** The preferences value. */
    preferences: createManagerToken<PreferenceManager>('PreferenceManager'),
    /** The shortcuts value. */
    shortcuts: createManagerToken<ShortcutManager>('ShortcutManager'),
    /** The sites value. */
    sites: createManagerToken<ProviderManager>('ProviderManager'),
    /** The updates value. */
    updates: createManagerToken<UpdateManager>('UpdateManager'),
    /** The video library value. */
    videoLibrary: createManagerToken<VideoLibraryManager>(
        'VideoLibraryManager',
    ),
    /** The Windows value. */
    viewerRuntime: createManagerToken<ViewerRuntime>('ViewerRuntime'),
} as const;

/** Describes the application manager options contract. */
export interface ApplicationManagerOptions {
    /** The bundle directory path value. */
    readonly bundleDirectoryPath: string;
    /** The development state file path value. */
    readonly developmentStateFilePath: string;
    /** The logging value. */
    readonly logging: LoggingManager;
    /** The preference file path value. */
    readonly preferenceFilePath: string;
    /** The video library file path value. */
    readonly videoLibraryFilePath: string;
    /** The standard video locations value. */
    readonly standardVideoLocations: readonly StandardVideoLocation[];
}

/** Creates the application manager container. */
export function createApplicationManagerContainer(
    options: ApplicationManagerOptions,
): ManagerContainer {
    const developmentExternalApps = __KAWAIKARA_EXTERNAL_APP_TESTING__ && useDevelopmentExternalApps(app.isPackaged, process.env.KAWAIKARA_EXTERNAL_APP_MODE);
    const managers = new ManagerContainer();

    managers
        .registerValue(MANAGER_TOKENS.logging, options.logging)
        .registerSingleton(
            MANAGER_TOKENS.preferences,
            () => new PreferenceManager(options.preferenceFilePath),
        )
        .registerSingleton(
            MANAGER_TOKENS.videoLibrary,
            (resolver) =>
                new VideoLibraryManager(
                    options.videoLibraryFilePath,
                    options.standardVideoLocations,
                    () =>
                        resolver.resolve(MANAGER_TOKENS.preferences).get()
                            .appLocale,
                ),
        )
        .registerSingleton(
            MANAGER_TOKENS.externalBrowser,
            () => new ExternalBrowserManager(),
        )
        .registerValue(
            MANAGER_TOKENS.pictureInPictureFactory,
            (...args) => new UnifiedPictureInPictureManager(...args),
        )
        .registerSingleton(MANAGER_TOKENS.viewerRuntime, (resolver) =>
            createViewerRuntime(
                resolver.resolve(MANAGER_TOKENS.externalBrowser),
                resolver.resolve(MANAGER_TOKENS.pictureInPictureFactory),
                resolver.resolve(MANAGER_TOKENS.logging),
            ),
        )
        .registerSingleton(MANAGER_TOKENS.sites, (resolver) => {
            const viewerRuntime = resolver.resolve(
                MANAGER_TOKENS.viewerRuntime,
            );
            const preferences = resolver.resolve(MANAGER_TOKENS.preferences);
            return new ProviderManager(
                (runtime, permissions) =>
                    viewerRuntime.site.createSiteContext(runtime, permissions),
                () => preferences.get(),
                () => viewerRuntime.site.getCurrentSiteAddress(),
                (state) => viewerRuntime.viewer.notifySiteTransition(state),
                resolver.resolve(MANAGER_TOKENS.externalApps),
                readExternalAppCookies,
            );
        })
        .registerSingleton(
            MANAGER_TOKENS.bundles,
            (resolver) =>
                new BundleManager(
                    resolver.resolve(MANAGER_TOKENS.sites),
                    options.bundleDirectoryPath,
                ),
        )
        .registerSingleton(
            MANAGER_TOKENS.development,
            (resolver) =>
                new BundleDevelopmentManager(
                    resolver.resolve(MANAGER_TOKENS.bundles),
                    options.developmentStateFilePath,
                    resolver.resolve(MANAGER_TOKENS.logging),
                ),
        )
        .registerSingleton(
            MANAGER_TOKENS.data,
            (resolver) =>
                new ApplicationDataManager(
                    resolver.resolve(MANAGER_TOKENS.sites),
                ),
        )
        .registerSingleton(MANAGER_TOKENS.shortcuts, (resolver) =>
            createApplicationShortcuts(
                resolver.resolve(MANAGER_TOKENS.sites),
                resolver.resolve(MANAGER_TOKENS.viewerRuntime),
                resolver.resolve(MANAGER_TOKENS.preferences),
            ),
        )
        .registerSingleton(MANAGER_TOKENS.developmentConnection, () => {
            if (__KAWAIKARA_EXTERNAL_APP_TESTING__) {
                const { createDevelopmentConnection } = require('../Functional/ExternalApps/DevelopmentConnectionFactory') as typeof import('../Functional/ExternalApps/DevelopmentConnectionFactory');
                return createDevelopmentConnection(path.dirname(options.preferenceFilePath));
            }
            throw new Error('External app test transport is not available in this build.');
        })
        .registerSingleton(
            MANAGER_TOKENS.youtubeDownloader,
            (resolver) =>
                new YouTubeDownloader(
                    () =>
                        resolver.resolve(MANAGER_TOKENS.preferences).get()
                            .appLocale,
                    resolver.resolve(MANAGER_TOKENS.logging),
                    developmentExternalApps ? resolver.resolve(MANAGER_TOKENS.developmentConnection) : undefined,
                ),
        )
        .registerSingleton(
            MANAGER_TOKENS.externalApps,
            (resolver) =>
                new ExternalAppManager(
                    [
                        createYouTubeDownloaderAdapter(
                            resolver.resolve(MANAGER_TOKENS.youtubeDownloader),
                        ),
                    ],
                    new ExternalAppPermissions(
                        path.join(
                            path.dirname(options.preferenceFilePath),
                            __KAWAIKARA_EXTERNAL_APP_TESTING__ && developmentExternalApps ? 'external-apps-development.json' : 'external-apps.json',
                        ),
                        () => {
                            resolver
                                .resolve(MANAGER_TOKENS.viewerRuntime)
                                .viewer.showExternalAppApproval();
                            app.focus({ steal: true });
                        },
                    ),
                    developmentExternalApps ? resolver.resolve(MANAGER_TOKENS.developmentConnection) : undefined,
                ),
        )
        .registerSingleton(
            MANAGER_TOKENS.updates,
            (resolver) =>
                new UpdateManager(
                    resolver.resolve(MANAGER_TOKENS.viewerRuntime),
                    resolver.resolve(MANAGER_TOKENS.logging),
                ),
        )
        .registerSingleton(
            MANAGER_TOKENS.social,
            (resolver) =>
                new SocialManager(
                    () =>
                        resolver.resolve(MANAGER_TOKENS.preferences).get()
                            .appLocale,
                ),
        )
        .registerSingleton(
            MANAGER_TOKENS.ipc,
            (resolver) =>
                new IpcManager(
                    resolver.resolve(MANAGER_TOKENS.bundles),
                    resolver.resolve(MANAGER_TOKENS.sites),
                    resolver.resolve(MANAGER_TOKENS.viewerRuntime),
                    resolver.resolve(MANAGER_TOKENS.preferences),
                    resolver.resolve(MANAGER_TOKENS.youtubeDownloader),
                    resolver.resolve(MANAGER_TOKENS.social),
                    resolver.resolve(MANAGER_TOKENS.updates),
                    resolver.resolve(MANAGER_TOKENS.shortcuts),
                    resolver.resolve(MANAGER_TOKENS.videoLibrary),
                    resolver.resolve(MANAGER_TOKENS.logging),
                    resolver.resolve(MANAGER_TOKENS.data),
                    resolver.resolve(MANAGER_TOKENS.development),
                    resolver.resolve(MANAGER_TOKENS.externalApps),
                ),
        );

    return managers;
}
