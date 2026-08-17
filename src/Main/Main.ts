import { app, components, Menu } from 'electron';
import { builtinSitesPlugin } from '@kawaikara/builtin-sites';
import { PluginHost } from './Plugin/PluginHost';
import path from 'node:path';
import type { UpdateManager } from './Manager/UpdateManager';
import {
    createApplicationManagerContainer,
    MANAGER_TOKENS,
} from './DependencyInjection/ApplicationManagers';
import {
    KAWAIKARA_PROTOCOL,
    parseExternalOpenArguments,
    parseExternalOpenUrl,
    type ExternalOpenRequest,
} from './Functional/ExternalOpen';
import {
    createLogger,
    configureLogLevel,
    finishLogSession,
    initializeLogging,
} from './Logging';
import {
    configureUserDataPaths,
    getKawaiDataPath,
    getUserDataLayout,
    initializeUserDataLayout,
} from './UserDataPaths';

configureUserDataPaths();
initializeLogging();
const applicationLog = createLogger('application');

// Keep Chromium composition and libmpv rendering on the GPU. The narrower
// Windows switches avoid the DRM black-surface issue without forcing the
// complete UI through CPU rasterization. A manual all-software escape hatch is
// retained for problematic drivers on every platform.
const forceSoftwareRendering =
    process.env.KAWAIKARA_FORCE_SOFTWARE_RENDERING === '1';
process.env.MPV_HWDEC ??= forceSoftwareRendering ? 'no' : 'auto-safe';

if (forceSoftwareRendering) {
    app.disableHardwareAcceleration();
    applicationLog.info('Rendering mode: forced all-software fallback.');
} else if (process.platform === 'win32') {
    app.commandLine.appendSwitch('disable-accelerated-video-decode');
    app.commandLine.appendSwitch(
        'disable-features',
        'DirectCompositionVideoOverlays',
    );
    applicationLog.info(
        'Windows rendering mode: GPU compositing, libmpv hardware decoding, Chromium software video decoding.',
    );
} else {
    applicationLog.info('Rendering mode: GPU compositing and libmpv hardware decoding.');
}

let disposeApplication: (() => Promise<void>) | undefined;
let shutdownStarted = false;
let externalOpenHandler: ((request: ExternalOpenRequest) => void) | undefined;
let externalOpenChain = Promise.resolve();
let applicationUpdates: UpdateManager | undefined;
const pendingExternalOpenRequests = parseExternalOpenArguments(process.argv);

registerProtocolClient();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        for (const request of parseExternalOpenArguments(argv)) {
            dispatchExternalOpenRequest(request);
        }
    });

    app.on('open-url', (event, url) => {
        event.preventDefault();
        const request = parseExternalOpenUrl(url);
        if (request) {
            dispatchExternalOpenRequest(request);
        }
    });

    app.whenReady()
        .then(startApplication)
        .catch((error: unknown) => {
            applicationLog.error('Kawaikara failed to start.', error);
            app.quit();
        });
}

async function startApplication(): Promise<void> {
    await initializeUserDataLayout();
    applicationLog.info('User data layout initialized.', getUserDataLayout());
    applicationLog.info('Application startup began.');
    Menu.setApplicationMenu(null);
    if (process.platform === 'darwin') {
        app.setActivationPolicy('regular');
        await app.dock?.show();
    }

    // Castlabs ECS installs or updates the Widevine component on first launch.
    // Do not create a viewer until the CDM is ready for DRM playback.
    await components.whenReady([components.WIDEVINE_CDM_ID]);

    const managers = createApplicationManagerContainer({
        preferenceFilePath: getKawaiDataPath('preferences.json'),
        videoLibraryFilePath: getKawaiDataPath('video-library.json'),
        standardVideoLocations: [
            { name: 'Home', path: app.getPath('home') },
            { name: 'Desktop', path: app.getPath('desktop') },
            { name: 'Downloads', path: app.getPath('downloads') },
            { name: 'Videos', path: app.getPath('videos') },
            { name: 'Documents', path: app.getPath('documents') },
        ],
    });
    const preferences = managers.resolve(MANAGER_TOKENS.preferences);
    const videoLibrary = managers.resolve(MANAGER_TOKENS.videoLibrary);
    await Promise.all([preferences.load(), videoLibrary.load()]);
    configureLogLevel(preferences.get().logLevel);

    const windows = managers.resolve(MANAGER_TOKENS.windows);
    windows.setAppLocale(preferences.get().appLocale, app.getLocale());
    windows.setAppTheme(preferences.get().appTheme);
    windows.createWindows();
    windows.setAlwaysOnTop(preferences.get().alwaysOnTop);
    windows.setMenuDismissBehavior(
        preferences.get().closeMenuOnEscape,
        preferences.get().closeMenuOnOutsideClick,
    );
    windows.setPictureInPicturePlacement(
        preferences.get().pictureInPicturePlacement,
    );
    windows.setPictureInPictureSize(preferences.get().pictureInPictureSize);
    windows.setPictureInPicturePortraitSize(
        preferences.get().pictureInPicturePortraitSize,
    );
    windows.setPictureInPicturePlacementRecorder(async (lastPlacement) => {
        const current = preferences.get().pictureInPicturePlacement;
        const next = await preferences.update({
            pictureInPicturePlacement: { ...current, lastPlacement },
        });
        windows.setPictureInPicturePlacement(next.pictureInPicturePlacement);
    });

    const sites = managers.resolve(MANAGER_TOKENS.sites);
    windows.setSiteHandlers({
        resolveNewWindowPolicy: (url) => sites.resolveNewWindowPolicy(url),
        handleAction: (action) => sites.handleAction(action),
        allowNavigation: (url) => sites.allowNavigation(url),
        allowPictureInPicture: (url) => sites.allowPictureInPicture(url),
        transformRequest: (details) => sites.transformRequest(details),
        transformRequestHeaders: (details) =>
            sites.transformRequestHeaders(details),
    });
    const plugins = new PluginHost(sites);
    plugins.install(builtinSitesPlugin);

    const shortcuts = managers.resolve(MANAGER_TOKENS.shortcuts);
    windows.setShortcutHandler((input, editing) =>
        shortcuts.handleInput(input, editing),
    );
    windows.setPictureInPictureStateHandler((active) =>
        shortcuts.setPictureInPictureActive(active),
    );

    const updates = managers.resolve(MANAGER_TOKENS.updates);
    updates.configure(preferences.get());
    applicationUpdates = updates;
    const discordPresence = managers.resolve(MANAGER_TOKENS.discordPresence);
    const ipc = managers.resolve(MANAGER_TOKENS.ipc);
    ipc.initialize();

    await windows.loadOverlay();
    const startupRequest = pendingExternalOpenRequests.shift();
    if (startupRequest) {
        await sites.openUrl(startupRequest.siteId, startupRequest.targetUrl);
        windows.focusViewer();
    } else {
        const configuredSite = preferences.get().defaultSiteId;
        await sites.load(
            sites.has(configuredSite) ? configuredSite : 'kawaikara.youtube',
        );
    }

    externalOpenHandler = (request) => {
        externalOpenChain = externalOpenChain
            .then(async () => {
                await sites.openUrl(request.siteId, request.targetUrl);
                windows.focusViewer();
            })
            .catch((error: unknown) => {
                console.error(
                    `Failed to open ${request.targetUrl} in Kawaikara.`,
                    error,
                );
            });
    };
    for (const request of pendingExternalOpenRequests.splice(0)) {
        externalOpenHandler(request);
    }

    if (!startupRequest && preferences.get().openMenuOnStartup) {
        windows.showOverlay();
    }

    void discordPresence.start();
    void updates.checkAtStartup();
    applicationLog.info('Application startup completed.', {
        defaultSiteId: preferences.get().defaultSiteId,
        startupRequest: Boolean(startupRequest),
    });

    disposeApplication = async () => {
        ipc.dispose();
        shortcuts.dispose();
        await sites.dispose();
        await Promise.all([discordPresence.dispose(), windows.dispose()]);
        applicationUpdates = undefined;
    };
}

function registerProtocolClient(): void {
    if (process.defaultApp && process.argv[1]) {
        app.setAsDefaultProtocolClient(KAWAIKARA_PROTOCOL, process.execPath, [
            path.resolve(process.argv[1]),
        ]);
        return;
    }
    app.setAsDefaultProtocolClient(KAWAIKARA_PROTOCOL);
}

function dispatchExternalOpenRequest(request: ExternalOpenRequest): void {
    if (externalOpenHandler) {
        externalOpenHandler(request);
        return;
    }
    pendingExternalOpenRequests.push(request);
}

app.on('before-quit', (event) => {
    if (applicationUpdates?.isInstalling()) {
        return;
    }
    if (shutdownStarted) {
        return;
    }

    shutdownStarted = true;
    event.preventDefault();
    const dispose = disposeApplication;
    disposeApplication = undefined;
    void Promise.resolve(dispose?.())
        .catch((error: unknown) => {
            applicationLog.error('Kawaikara shutdown failed.', error);
        })
        .finally(() => {
            finishLogSession();
            app.quit();
        });
});

app.on('window-all-closed', () => {
    // Kawaikara is a single-viewer utility. Closing its main window means quit,
    // including on macOS where Electron normally keeps the app alive.
    app.quit();
});
