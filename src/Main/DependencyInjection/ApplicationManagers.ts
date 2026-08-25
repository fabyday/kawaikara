import { DeveloperLinkManager } from '../Manager/DeveloperLinkManager';
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
  type PictureInPictureManagerFactory,
  WindowManager,
} from '../Manager/WindowManager';
import { UpdateManager } from '../Manager/UpdateManager';
import {
  VideoLibraryManager,
  type StandardVideoLocation,
} from '../Manager/VideoLibraryManager';
import {
  createManagerToken,
  ManagerContainer,
} from './ManagerContainer';

export const MANAGER_TOKENS = {
  bundles: createManagerToken<BundleManager>('BundleManager'),
  data: createManagerToken<ApplicationDataManager>('ApplicationDataManager'),
  developerLinks: createManagerToken<DeveloperLinkManager>(
    'DeveloperLinkManager',
  ),
  discordPresence: createManagerToken<DiscordPresenceManager>(
    'DiscordPresenceManager',
  ),
  downloads: createManagerToken<ExternalDownloaderManager>(
    'ExternalDownloaderManager',
  ),
  externalBrowser: createManagerToken<ExternalBrowserManager>(
    'ExternalBrowserManager',
  ),
  ipc: createManagerToken<IpcManager>('IpcManager'),
  logging: createManagerToken<LoggingManager>('LoggingManager'),
  pictureInPictureFactory: createManagerToken<PictureInPictureManagerFactory>(
    'PictureInPictureManagerFactory',
  ),
  preferences: createManagerToken<PreferenceManager>('PreferenceManager'),
  shortcuts: createManagerToken<ShortcutManager>('ShortcutManager'),
  sites: createManagerToken<SiteManager>('SiteManager'),
  updates: createManagerToken<UpdateManager>('UpdateManager'),
  videoLibrary: createManagerToken<VideoLibraryManager>('VideoLibraryManager'),
  windows: createManagerToken<WindowManager>('WindowManager'),
} as const;

export interface ApplicationManagerOptions {
  readonly bundleDirectoryPath: string;
  readonly logging: LoggingManager;
  readonly preferenceFilePath: string;
  readonly videoLibraryFilePath: string;
  readonly standardVideoLocations: readonly StandardVideoLocation[];
}

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
        ),
    );

  return managers;
}
