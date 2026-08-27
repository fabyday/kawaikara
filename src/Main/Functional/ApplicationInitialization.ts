import { app, components } from 'electron';
import { builtinBundle } from '@kawaikara/builtin-sites';
import { rm } from 'node:fs/promises';
import {
  createApplicationManagerContainer,
  MANAGER_TOKENS,
} from '../DependencyInjection/ApplicationManagers';
import type { BundleDevelopmentManager } from '../Manager/BundleDevelopmentManager';
import type { DiscordPresenceManager } from '../Manager/DiscordPresenceManager';
import type { IpcManager } from '../Manager/IPCManager';
import type { PreferenceManager } from '../Manager/PreferenceManager';
import type { ShortcutManager } from '../Manager/ShortcutManager';
import type { SiteManager } from '../Manager/SiteManager';
import type { UpdateManager } from '../Manager/UpdateManager';
import type { WindowManager } from '../Manager/WindowManager';
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
  /** The discord presence value. */
  readonly discordPresence: DiscordPresenceManager;
  /** The IPC value. */
  readonly ipc: IpcManager;
  /** The preferences value. */
  readonly preferences: PreferenceManager;
  /** The shortcuts value. */
  readonly shortcuts: ShortcutManager;
  /** The sites value. */
  readonly sites: SiteManager;
  /** The updates value. */
  readonly updates: UpdateManager;
  /** The Windows value. */
  readonly windows: WindowManager;
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

  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular');
    await app.dock?.show();
  }

  // Castlabs ECS installs or updates Widevine on first launch. Viewer creation
  // must wait so DRM providers never start without the component.
  await components.whenReady([components.WIDEVINE_CDM_ID]);

  const managers = createApplicationManagerContainer({
    bundleDirectoryPath: getKawaiDataPath('Bundles'),
    developmentStateFilePath: getKawaiDataPath('Development', 'projects.json'),
    logging,
    preferenceFilePath,
    videoLibraryFilePath: getKawaiDataPath('video-library.json'),
    standardVideoLocations: [
      { name: 'Home', path: app.getPath('home')
      },
      { name: 'Desktop', path: app.getPath('desktop')
      },
      { name: 'Downloads', path: app.getPath('downloads')
      },
      { name: 'Videos', path: app.getPath('videos')
      },
      { name: 'Documents', path: app.getPath('documents')
      },
    ],
  });
  const preferences = managers.resolve(MANAGER_TOKENS.preferences);
  const videoLibrary = managers.resolve(MANAGER_TOKENS.videoLibrary);
  await Promise.all([preferences.load(), videoLibrary.load()]);
  logging.configureLevel(preferences.get().logLevel);

  const windows = managers.resolve(MANAGER_TOKENS.windows);
  configureWindows(windows, preferences);
  const sites = managers.resolve(MANAGER_TOKENS.sites);
  connectSites(windows, sites);

  const bundles = managers.resolve(MANAGER_TOKENS.bundles);
  bundles.installBundled(builtinBundle);
  await bundles.loadInstalled();

  const development = managers.resolve(MANAGER_TOKENS.development);
  await development.initialize(preferences.get());
  const shortcuts = managers.resolve(MANAGER_TOKENS.shortcuts);
  windows.setShortcutHandler((input, editing) =>
    shortcuts.handleInput(input, editing),
  );
  windows.setPictureInPictureStateHandler((active) =>
    shortcuts.setPictureInPictureActive(active),
  );

  const updates = managers.resolve(MANAGER_TOKENS.updates);
  updates.configure(preferences.get());
  const discordPresence = managers.resolve(MANAGER_TOKENS.discordPresence);
  const ipc = managers.resolve(MANAGER_TOKENS.ipc);
  ipc.initialize();

  return {
    ...preInitialized,
    /** The development value. */
    development,
    /** The discord presence value. */
    discordPresence,
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
    windows,
    /** The dispose value. */
    dispose: async () => {
      shortcuts.dispose();
      await development.dispose();
      await sites.dispose();
      await Promise.all([discordPresence.dispose(), windows.dispose()]);
      // Renderers are gone now, so their final effects cannot race handler
      // removal during shutdown.
      ipc.dispose();
    },
  };
}

/** Performs the configure Windows operation. */
function configureWindows(
  windows: WindowManager,
  preferences: PreferenceManager,
): void {
  const current = preferences.get();
  windows.setAppLocale(current.appLocale, app.getLocale());
  windows.setAppTheme(current.appTheme);
  windows.createWindows();
  windows.setAlwaysOnTop(current.alwaysOnTop);
  windows.setMenuDismissBehavior(
    current.closeMenuOnEscape,
    current.closeMenuOnOutsideClick,
  );
  windows.configureStartupDevTools(
    current.openDevToolsAutomatically,
    current.devToolsMode,
  );
  windows.setPictureInPicturePlacement(current.pictureInPicturePlacement);
  windows.setPictureInPictureSize(current.pictureInPictureSize);
  windows.setPictureInPicturePortraitSize(current.pictureInPicturePortraitSize);
  windows.setPictureInPicturePlacementRecorder(async (lastPlacement) => {
    const placement = preferences.get().pictureInPicturePlacement;
    const next = await preferences.update({
      pictureInPicturePlacement: { ...placement, lastPlacement
      },
    });
    windows.setPictureInPicturePlacement(next.pictureInPicturePlacement);
  });
}

/** Performs the connect sites operation. */
function connectSites(windows: WindowManager, sites: SiteManager): void {
  windows.setSiteHandlers({
    resolveNewWindowPolicy: (url) => sites.resolveNewWindowPolicy(url),
    handleAction: (action) => sites.handleAction(action),
    allowNavigation: (url) => sites.allowNavigation(url),
    allowPictureInPicture: (url) => sites.allowPictureInPicture(url),
    getPictureInPictureContentOverlaySelectors: () =>
      sites.getPictureInPictureContentOverlaySelectors(),
    transformRequest: (details) => sites.transformRequest(details),
    transformRequestHeaders: (details) => sites.transformRequestHeaders(details),
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
    applicationLog.warn('Legacy development cache could not be removed.', error);
  });
}
