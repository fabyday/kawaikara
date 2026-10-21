import { completeCleanup } from './Cleanup';
import { builtinBundle } from '@kawaikara/builtin-sites';
import { app, components } from 'electron';
import { rm } from 'node:fs/promises';
import {
    createApplicationManagerContainer,
    MANAGER_TOKENS,
} from '../../DependencyInjection/ApplicationManagers';
import type { BundleDevelopmentManager } from '../../Manager/BundleDevelopmentManager';
import type { IpcManager } from '../../Manager/IPCManager';
import type { PreferenceManager } from '../../Manager/PreferenceManager';
import type { ProviderManager } from '../../Manager/ProviderManager';
import type { ShortcutManager } from '../../Manager/ShortcutManager';
import type { SocialManager } from '../../Manager/SocialManager';
import type { UpdateManager } from '../../Manager/UpdateManager';
import type { VideoLibraryManager } from '../../Manager/VideoLibraryManager';
import { WebExtensionManager } from '../../Manager/WebExtensionManager';
import { restoreApplicationPresentation } from '../../Platform/Presentation';
import { type ViewerRuntime } from '../Viewer/ViewerRuntime';
import type { PreInitializedApplication } from './ApplicationPreInitialization';
import {
    getKawaiDataPath,
    getUserDataLayout,
    initializeUserDataLayout,
} from './UserDataPaths';

/** Describes the initialized application contract. */
export interface InitializedApplication extends PreInitializedApplication {
    /** The development value. */
    readonly development: BundleDevelopmentManager;
    /** Shared social integrations and View-facing actions. */
    readonly social: SocialManager;
    /** The IPC value. */
    readonly ipc: IpcManager;
    /** The preferences value. */
    readonly preferences: PreferenceManager;
    /** The shortcuts value. */
    readonly shortcuts: ShortcutManager;
    /** The sites value. */
    readonly sites: ProviderManager;
    /** The updates value. */
    readonly updates: UpdateManager;
    /** The Windows value. */
    readonly viewerRuntime: ViewerRuntime;
    /** Local video validation and library persistence. */
    readonly videoLibrary: VideoLibraryManager;
    /** Releases the operation. */
    dispose(): Promise<void>;
}

/** Create, load, and connect managers after Electron is ready. */
export async function initializeApplication(
    preInitialized: PreInitializedApplication,
): Promise<InitializedApplication> {
    const { applicationLog, logging, preferenceFilePath } = preInitialized;
    await initializeUserDataLayout();
    await removeLegacyDevelopmentCache(applicationLog);
    applicationLog.info('User data layout initialized.', getUserDataLayout());
    applicationLog.info('Application startup began.');

    await restoreApplicationPresentation();

    // Castlabs ECS installs or updates Widevine on first launch. Viewer creation
    // must wait so DRM providers never start without the component.
    if (!__KAWAIKARA_UPDATE_TEST_PROFILE__)
        await components.whenReady([components.WIDEVINE_CDM_ID]);

    const managers = createApplicationManagerContainer({
        bundleDirectoryPath: getKawaiDataPath('Bundles'),
        developmentStateFilePath: getKawaiDataPath(
            'Development',
            'projects.json',
        ),
        logging,
        preferenceFilePath,
        videoLibraryFilePath: getKawaiDataPath('video-library.json'),
        standardVideoLocations: [
            { name: '', nameKey: 'home', path: app.getPath('home') },
            { name: '', nameKey: 'desktop', path: app.getPath('desktop') },
            { name: '', nameKey: 'downloads', path: app.getPath('downloads') },
            { name: '', nameKey: 'videos', path: app.getPath('videos') },
            { name: '', nameKey: 'documents', path: app.getPath('documents') },
        ],
    });
    const preferences = managers.resolve(MANAGER_TOKENS.preferences);
    const videoLibrary = managers.resolve(MANAGER_TOKENS.videoLibrary);
    await Promise.all([preferences.load(), videoLibrary.load()]);
    logging.configure(preferences.get().logLevel, preferences.get().logSources);

    const viewerRuntime = managers.resolve(MANAGER_TOKENS.viewerRuntime);
    configureWindows(viewerRuntime, preferences);
    const sites = managers.resolve(MANAGER_TOKENS.sites);
    connectSites(viewerRuntime, sites);

    const bundles = managers.resolve(MANAGER_TOKENS.bundles);
    bundles.installBundled(builtinBundle);
    await bundles.loadInstalled();

    const development = managers.resolve(MANAGER_TOKENS.development);
    await development.initialize(preferences.get());
    const shortcuts = managers.resolve(MANAGER_TOKENS.shortcuts);
    viewerRuntime.input.setShortcutHandler((input, editing) =>
        shortcuts.handleInput(input, editing),
    );
    viewerRuntime.pip.setPictureInPictureStateHandler(() =>
        shortcuts.refreshGlobalShortcut(),
    );

    const updates = managers.resolve(MANAGER_TOKENS.updates);
    updates.configure(preferences.get());
    const social = managers.resolve(MANAGER_TOKENS.social);
    updates.setInstallLifecycle({
        /** Releases native surfaces only after Squirrel has accepted the download. */
        prepare: async () => {
            await viewerRuntime.lifecycle.prepareForUpdateInstallation();
            await preferences.flush();
            shortcuts.dispose();
        },
        /** Keeps IPC, sites, and viewerRuntime alive and restores shortcuts on a failed handoff. */
        recover: async () => {
            shortcuts.refreshGlobalShortcut();
            await viewerRuntime.lifecycle.recoverAfterFailedUpdate();
        },
    });
    const webExtension = new WebExtensionManager(
        getKawaiDataPath('web-extension.json'),
        sites,
        viewerRuntime,
        () => preferences.get().appLocale,
    );
    if (!__KAWAIKARA_UPDATE_TEST_PROFILE__) await webExtension.start();
    const ipc = managers.resolve(MANAGER_TOKENS.ipc);
    if (!__KAWAIKARA_UPDATE_TEST_PROFILE__)
        ipc.setWebExtensionManager(webExtension);
    ipc.initialize();
    const externalApps = managers.resolve(MANAGER_TOKENS.externalApps);
    if (externalApps.developmentConnection && !__KAWAIKARA_UPDATE_TEST_PROFILE__) {
        await externalApps.developmentConnection!.start({
            register: async (id) => {
                const descriptor = externalApps.descriptors().find(item => item.id === id);
                return !!descriptor && !!await externalApps.permissions.register(descriptor);
            },
            registered: async (id) => {
                const descriptor = externalApps.descriptors().find(item => item.id === id);
                return !!descriptor && !!await externalApps.permissions.get(descriptor);
            },
            revoke: (id) => externalApps.permissions.revoke(id),
        });
    }

    return {
        ...preInitialized,
        /** The development value. */
        development,
        /** Shared social integrations and View-facing actions. */
        social,
        /** The IPC value. */
        ipc,
        /** The preferences value. */
        preferences,
        /** The shortcuts value. */
        shortcuts,
        /** The sites value. */
        sites,
        /** The updates value. */
        updates,
        /** The Windows value. */
        viewerRuntime,
        /** Local video validation and library persistence. */
        videoLibrary,
        /** The dispose value. */
        dispose: async () => {
            viewerRuntime.lifecycle.beginViewerShutdown();
            await completeCleanup([
                () => shortcuts.dispose(),
                () => webExtension.dispose(),
                () => externalApps.developmentConnection?.dispose(),
                () => development.dispose(),
                () => sites.dispose(),
                () => social.dispose(),
                () => viewerRuntime.lifecycle.dispose(),
                // Renderer teardown precedes removal of its IPC handlers.
                () => ipc.dispose(),
            ]);
        },
    };
}

/** Performs the configure Windows operation. */
function configureWindows(
    viewerRuntime: ViewerRuntime,
    preferences: PreferenceManager,
): void {
    const current = preferences.get();
    viewerRuntime.viewer.setAppLocale(current.appLocale, app.getLocale());
    viewerRuntime.viewer.setAppTheme(current.appTheme);
    viewerRuntime.windows.configureStartupWindow(
        current.appWindow,
        current.appWindowLastPosition,
        async (appWindowLastPosition) => {
            await preferences.update({ appWindowLastPosition });
        },
    );
    viewerRuntime.viewer.createWindows();
    viewerRuntime.windows.setAlwaysOnTop(current.alwaysOnTop);
    viewerRuntime.viewer.setMenuDismissBehavior(
        current.closeMenuOnEscape,
        current.closeMenuOnOutsideClick,
    );
    viewerRuntime.diagnostics.configureStartupDevTools(
        current.openDevToolsAutomatically,
        current.devToolsMode,
    );
    viewerRuntime.pip.setPictureInPicturePlacement(
        current.pictureInPicturePlacement,
    );
    viewerRuntime.pip.setPictureInPictureSize(current.pictureInPictureSize);
    viewerRuntime.pip.setPictureInPicturePortraitSize(
        current.pictureInPicturePortraitSize,
    );
    void viewerRuntime.pip.setPictureInPictureSubtitleScale(
        current.pictureInPictureSubtitleScale,
    );
    viewerRuntime.pip.setPictureInPicturePlacementRecorder(
        async (lastPlacement) => {
            const placement = preferences.get().pictureInPicturePlacement;
            const next = await preferences.update({
                pictureInPicturePlacement: { ...placement, lastPlacement },
            });
            viewerRuntime.pip.setPictureInPicturePlacement(
                next.pictureInPicturePlacement,
            );
        },
    );
}

/** Performs the connect sites operation. */
function connectSites(
    viewerRuntime: ViewerRuntime,
    sites: ProviderManager,
): void {
    viewerRuntime.site.setSiteHandlers({
        resolveNewWindowPolicy: (url) => sites.resolveNewWindowPolicy(url),
        handleAction: (action) => sites.handleAction(action),
        allowNavigation: (url) => sites.allowNavigation(url),
        allowPictureInPicture: (url) => sites.allowPictureInPicture(url),
        getPictureInPictureContentOverlaySelectors: () =>
            sites.getPictureInPictureContentOverlaySelectors(),
        createPictureInPictureSubtitleController: (session) =>
            sites.createPictureInPictureSubtitleController(session),
        transformRequest: (details) => sites.transformRequest(details),
        transformRequestHeaders: (details) =>
            sites.transformRequestHeaders(details),
    });
}

/** Removes the legacy development cache. */
async function removeLegacyDevelopmentCache(
    applicationLog: PreInitializedApplication['applicationLog'],
): Promise<void> {
    await rm(getKawaiDataPath('Development', 'Bundles'), {
        recursive: true,
        force: true,
    }).catch((error: unknown) => {
        applicationLog.warn(
            'Legacy development cache could not be removed.',
            error,
        );
    });
}
