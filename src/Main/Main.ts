import { app, components, Menu } from 'electron';
import { builtinSitesPlugin } from '@kawaikara/builtin-sites';
import { IpcManager } from './Manager/IPCManager';
import { SiteManager } from './Manager/SiteManager';
import { WindowManager } from './Manager/WindowManager';
import { PluginHost } from './Plugin/PluginHost';
import { PreferenceManager } from './Manager/PreferenceManager';
import path from 'node:path';
import { ExternalDownloaderManager } from './Manager/ExternalDownloaderManager';
import { ShortcutManager } from './Manager/ShortcutManager';
import { DeveloperLinkManager } from './Manager/DeveloperLinkManager';
import { UpdateManager } from './Manager/UpdateManager';
import { DiscordPresenceManager } from './Manager/DiscordPresenceManager';
import {
  KAWAIKARA_PROTOCOL,
  parseExternalOpenArguments,
  parseExternalOpenUrl,
  type ExternalOpenRequest,
} from './ExternalOpen';

// Keep Chromium's GPU process disabled, matching the main branch behavior.
// Electron requires this to be called before the app becomes ready.
app.disableHardwareAcceleration();

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

  app.whenReady().then(startApplication).catch((error: unknown) => {
    console.error('Kawaikara failed to start.', error);
    app.quit();
  });
}

async function startApplication(): Promise<void> {
  Menu.setApplicationMenu(null);
  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular');
    await app.dock?.show();
  }

  // Castlabs ECS installs or updates the Widevine component on first launch.
  // Do not create a viewer until the CDM is ready for DRM playback.
  await components.whenReady([components.WIDEVINE_CDM_ID]);

  const preferences = new PreferenceManager(
    path.join(app.getPath('userData'), 'preferences.json'),
  );
  await preferences.load();

  const windows = new WindowManager();
  windows.createWindows();
  windows.setAppLocale(preferences.get().appLocale, app.getLocale());
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

  const sites = new SiteManager(
    (runtime) => windows.createSiteContext(runtime),
    () => preferences.get(),
  );
  windows.setSiteHandlers({
    resolveNewWindowPolicy: (url) => sites.resolveNewWindowPolicy(url),
    handleAction: (action) => sites.handleAction(action),
    allowNavigation: (url) => sites.allowNavigation(url),
    allowPictureInPicture: (url) => sites.allowPictureInPicture(url),
    transformRequestHeaders: (details) => sites.transformRequestHeaders(details),
  });
  const plugins = new PluginHost(sites);
  plugins.install(builtinSitesPlugin);

  const shortcuts = new ShortcutManager(sites, windows, preferences);
  windows.setShortcutHandler((input, editing) =>
    shortcuts.handleInput(input, editing),
  );
  windows.setPictureInPictureStateHandler((active) =>
    shortcuts.setPictureInPictureActive(active),
  );

  const downloads = new ExternalDownloaderManager();
  const developerLinks = new DeveloperLinkManager();
  const updates = new UpdateManager();
  updates.configure(preferences.get());
  applicationUpdates = updates;
  const discordPresence = new DiscordPresenceManager();
  const ipc = new IpcManager(
    sites,
    windows,
    preferences,
    downloads,
    developerLinks,
    updates,
    shortcuts,
  );
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
        console.error(`Failed to open ${request.targetUrl} in Kawaikara.`, error);
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
      console.error('Kawaikara shutdown failed.', error);
    })
    .finally(() => app.quit());
});

app.on('window-all-closed', () => {
  // Kawaikara is a single-viewer utility. Closing its main window means quit,
  // including on macOS where Electron normally keeps the app alive.
  app.quit();
});
