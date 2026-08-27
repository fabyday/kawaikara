import { DeveloperLinkManager } from '../Manager/DeveloperLinkManager';
import { BundleDevelopmentManager } from '../Manager/BundleDevelopmentManager';
import { BundleManager } from '../Manager/BundleManager';
import { DiscordPresenceManager } from '../Manager/DiscordPresenceManager';
import { ExternalBrowserManager } from '../Manager/ExternalBrowserManager';
import { ExternalDownloaderManager } from '../Manager/ExternalDownloaderManager';
import { IpcManager } from '../Manager/IPCManager';
import { LoggingManager } from '../Manager/LoggingManager';
import { ApplicationDataManager } from '../Manager/ApplicationDataManager';
import { PreferenceManager } from '../Manager/PreferenceManager';
import { ShortcutManager } from '../Manager/ShortcutManager';
import { SiteManager } from '../Manager/SiteManager';
import { UnifiedPictureInPictureManager } from '../Manager/UnifiedPictureInPictureManager';
import {
  WindowManager,
} from '../Manager/WindowManager';
import type { PictureInPictureManagerFactory } from '../Functional/WindowRuntime';
import { UpdateManager } from '../Manager/UpdateManager';
import {
  VideoLibraryManager,
} from '../Manager/VideoLibraryManager';
import type { StandardVideoLocation } from '../Functional/VideoLibrary';
import {
  createManagerToken,
  ManagerContainer,
} from './ManagerContainer';

/** Defines the shared manager tokens constant. */
export const MANAGER_TOKENS = {
  /** The bundles value. */
  bundles: createManagerToken<BundleManager>('BundleManager'),
  /** The data value. */
  data: createManagerToken<ApplicationDataManager>('ApplicationDataManager'),
  /** The developer links value. */
  developerLinks: createManagerToken<DeveloperLinkManager>(
    'DeveloperLinkManager',
  ),
  /** The development value. */
  development: createManagerToken<BundleDevelopmentManager>(
    'BundleDevelopmentManager',
  ),
  /** The discord presence value. */
  discordPresence: createManagerToken<DiscordPresenceManager>(
    'DiscordPresenceManager',
  ),
  /** The downloads value. */
  downloads: createManagerToken<ExternalDownloaderManager>(
    'ExternalDownloaderManager',
  ),
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
  sites: createManagerToken<SiteManager>('SiteManager'),
  /** The updates value. */
  updates: createManagerToken<UpdateManager>('UpdateManager'),
  /** The video library value. */
  videoLibrary: createManagerToken<VideoLibraryManager>('VideoLibraryManager'),
  /** The Windows value. */
  windows: createManagerToken<WindowManager>('WindowManager'),
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
  const managers = new ManagerContainer();

  managers
    .registerValue(MANAGER_TOKENS.logging, options.logging)
    .registerSingleton(
      MANAGER_TOKENS.preferences,
      () => new PreferenceManager(options.preferenceFilePath),
    )
    .registerSingleton(
      MANAGER_TOKENS.videoLibrary,
      () =>
        new VideoLibraryManager(
          options.videoLibraryFilePath,
          options.standardVideoLocations,
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
    .registerSingleton(
      MANAGER_TOKENS.windows,
      (resolver) =>
        new WindowManager(
          resolver.resolve(MANAGER_TOKENS.externalBrowser),
          resolver.resolve(MANAGER_TOKENS.pictureInPictureFactory),
          resolver.resolve(MANAGER_TOKENS.logging),
        ),
    )
    .registerSingleton(
      MANAGER_TOKENS.sites,
      (resolver) => {
        const windows = resolver.resolve(MANAGER_TOKENS.windows);
        const preferences = resolver.resolve(MANAGER_TOKENS.preferences);
        return new SiteManager(
          (runtime, permissions) => windows.createSiteContext(runtime, permissions),
          () => preferences.get(),
          () => windows.getCurrentSiteAddress(),
        );
      },
    )
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
        new ApplicationDataManager(resolver.resolve(MANAGER_TOKENS.sites)),
    )
    .registerSingleton(
      MANAGER_TOKENS.shortcuts,
      (resolver) =>
        new ShortcutManager(
          resolver.resolve(MANAGER_TOKENS.sites),
          resolver.resolve(MANAGER_TOKENS.windows),
          resolver.resolve(MANAGER_TOKENS.preferences),
        ),
    )
    .registerSingleton(
      MANAGER_TOKENS.downloads,
      () => new ExternalDownloaderManager(),
    )
    .registerSingleton(
      MANAGER_TOKENS.developerLinks,
      () => new DeveloperLinkManager(),
    )
    .registerSingleton(
      MANAGER_TOKENS.updates,
      (resolver) =>
        new UpdateManager(
          resolver.resolve(MANAGER_TOKENS.windows),
          resolver.resolve(MANAGER_TOKENS.logging),
        ),
    )
    .registerSingleton(
      MANAGER_TOKENS.discordPresence,
      () => new DiscordPresenceManager(),
    )
    .registerSingleton(
      MANAGER_TOKENS.ipc,
      (resolver) =>
        new IpcManager(
          resolver.resolve(MANAGER_TOKENS.bundles),
          resolver.resolve(MANAGER_TOKENS.sites),
          resolver.resolve(MANAGER_TOKENS.windows),
          resolver.resolve(MANAGER_TOKENS.preferences),
          resolver.resolve(MANAGER_TOKENS.downloads),
          resolver.resolve(MANAGER_TOKENS.developerLinks),
          resolver.resolve(MANAGER_TOKENS.updates),
          resolver.resolve(MANAGER_TOKENS.shortcuts),
          resolver.resolve(MANAGER_TOKENS.videoLibrary),
          resolver.resolve(MANAGER_TOKENS.logging),
          resolver.resolve(MANAGER_TOKENS.data),
          resolver.resolve(MANAGER_TOKENS.development),
        ),
    );

  return managers;
}
