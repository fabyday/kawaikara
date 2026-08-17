import { DeveloperLinkManager } from '../Manager/DeveloperLinkManager';
import { DiscordPresenceManager } from '../Manager/DiscordPresenceManager';
import { ExternalBrowserManager } from '../Manager/ExternalBrowserManager';
import { ExternalDownloaderManager } from '../Manager/ExternalDownloaderManager';
import { IpcManager } from '../Manager/IPCManager';
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
  readonly preferenceFilePath: string;
  readonly videoLibraryFilePath: string;
  readonly standardVideoLocations: readonly StandardVideoLocation[];
}

export function createApplicationManagerContainer(
  options: ApplicationManagerOptions,
): ManagerContainer {
  const managers = new ManagerContainer();

  managers
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
        ),
    )
    .registerSingleton(
      MANAGER_TOKENS.sites,
      (resolver) => {
        const windows = resolver.resolve(MANAGER_TOKENS.windows);
        const preferences = resolver.resolve(MANAGER_TOKENS.preferences);
        return new SiteManager(
          (runtime) => windows.createSiteContext(runtime),
          () => preferences.get(),
        );
      },
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
    .registerSingleton(MANAGER_TOKENS.updates, () => new UpdateManager())
    .registerSingleton(
      MANAGER_TOKENS.discordPresence,
      () => new DiscordPresenceManager(),
    )
    .registerSingleton(
      MANAGER_TOKENS.ipc,
      (resolver) =>
        new IpcManager(
          resolver.resolve(MANAGER_TOKENS.sites),
          resolver.resolve(MANAGER_TOKENS.windows),
          resolver.resolve(MANAGER_TOKENS.preferences),
          resolver.resolve(MANAGER_TOKENS.downloads),
          resolver.resolve(MANAGER_TOKENS.developerLinks),
          resolver.resolve(MANAGER_TOKENS.updates),
          resolver.resolve(MANAGER_TOKENS.shortcuts),
          resolver.resolve(MANAGER_TOKENS.videoLibrary),
        ),
    );

  return managers;
}
