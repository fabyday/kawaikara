import { app, ipcMain, type IpcMainEvent } from 'electron';
import { KAWAIKARA_SITE_API_VERSION } from '@kawaikara/site-api';
import {
  IPC_CHANNELS,
  type ApplicationLinkId,
  type IpcChannel,
} from '../../Common/IPC';
import { BUILD_CHANNEL, isReleaseChannel } from '../../Common/BuildConfig';
import type { SiteManager } from './SiteManager';
import type { WindowManager } from './WindowManager';
import type { PreferenceManager } from './PreferenceManager';
import type { ExternalDownloaderManager } from './ExternalDownloaderManager';
import type { DeveloperLinkManager } from './DeveloperLinkManager';
import type { UpdateManager } from './UpdateManager';
import type { ShortcutManager } from './ShortcutManager';

export class IpcManager {
  private readonly handleEditingChanged = (
    event: IpcMainEvent,
    editing: unknown,
  ): void => {
    if (typeof editing !== 'boolean') return;
    this.windows.setEditingState(event.sender.id, editing);
  };

  constructor(
    private readonly sites: SiteManager,
    private readonly windows: WindowManager,
    private readonly preferences: PreferenceManager,
    private readonly downloads: ExternalDownloaderManager,
    private readonly developerLinks: DeveloperLinkManager,
    private readonly updates: UpdateManager,
    private readonly shortcuts: ShortcutManager,
  ) {}

  initialize(): void {
    ipcMain.on(
      IPC_CHANNELS.overlay.editingChanged,
      this.handleEditingChanged,
    );
    ipcMain.handle(IPC_CHANNELS.application.info, () => ({
      name: app.getName(),
      version: app.getVersion(),
      siteApiVersion: KAWAIKARA_SITE_API_VERSION,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      buildChannel: BUILD_CHANNEL,
      updateChannelLocked: BUILD_CHANNEL === 'nightly',
    }));
    ipcMain.handle(IPC_CHANNELS.application.listDisplays, () =>
      this.windows.listDisplays(),
    );
    ipcMain.handle(
      IPC_CHANNELS.application.openLink,
      async (_event, id: unknown) => {
        if (!isApplicationLinkId(id)) {
          throw new TypeError('Unknown application link.');
        }
        await this.developerLinks.open(id);
      },
    );
    ipcMain.handle(IPC_CHANNELS.application.developerYouTubeStatus, () =>
      this.developerLinks.getDeveloperYouTubeStatus(),
    );
    ipcMain.handle(
      IPC_CHANNELS.application.checkForUpdates,
      (_event, channel: unknown) => {
        if (channel !== undefined && !isReleaseChannel(channel)) {
          throw new TypeError('Unknown update channel.');
        }
        return this.updates.checkForUpdates(true, channel);
      },
    );
    ipcMain.handle(IPC_CHANNELS.plugins.list, () => this.sites.listPlugins());
    ipcMain.handle(IPC_CHANNELS.media.togglePictureInPicture, () =>
      this.windows.togglePictureInPicture(),
    );
    ipcMain.handle(IPC_CHANNELS.media.toggleGamePictureInPicture, () =>
      this.windows.toggleGamePictureInPicture(),
    );
    ipcMain.handle(IPC_CHANNELS.sites.list, () => this.sites.listMenuItems());
    ipcMain.handle(IPC_CHANNELS.sites.open, async (_event, id: unknown) => {
      if (typeof id !== 'string') {
        throw new TypeError('Site id must be a string.');
      }
      this.windows.hideOverlay();
      await this.sites.load(id);
    });
    ipcMain.handle(IPC_CHANNELS.overlay.close, () => {
      this.windows.hideOverlay();
    });
    ipcMain.handle(IPC_CHANNELS.overlay.setView, (_event, view: unknown) => {
      if (view === 'menu') {
        this.windows.showOverlay();
        return;
      }
      if (view === 'preference') {
        this.windows.showPreferencesOverlay();
        return;
      }
      throw new TypeError('Overlay view must be menu or preference.');
    });
    ipcMain.handle(
      IPC_CHANNELS.video.openDroppedFiles,
      async (_event, paths: unknown) => {
        if (!(await this.windows.queueDroppedVideoFiles(paths))) {
          return false;
        }
        this.windows.hideOverlay();
        await this.sites.load('kawaikara.video');
        return true;
      },
    );
    ipcMain.handle(IPC_CHANNELS.video.getOpenRequest, () =>
      this.windows.getCurrentVideoOpenRequest(),
    );
    ipcMain.handle(
      IPC_CHANNELS.downloads.openYouTube,
      async (_event, url: unknown) => {
        if (typeof url !== 'string' || !isYouTubeUrl(url)) {
          throw new TypeError('A valid YouTube URL is required.');
        }
        const result = await this.downloads.open(url);
        if (!result.opened) {
          this.windows.queueYouTubeDownloader(url);
          this.windows.hideOverlay();
          await this.sites.load('kawaikara.video');
        }
        return result;
      },
    );
    ipcMain.handle(IPC_CHANNELS.downloads.status, () =>
      this.downloads.getStatus(),
    );
    ipcMain.handle(IPC_CHANNELS.downloads.install, (_event, url: unknown) =>
      this.downloads.install(url),
    );
    ipcMain.handle(IPC_CHANNELS.downloads.open, (_event, url: unknown) =>
      this.downloads.open(url),
    );
    ipcMain.handle(IPC_CHANNELS.downloads.openReleasePage, () =>
      this.downloads.openReleasePage(),
    );
    ipcMain.handle(IPC_CHANNELS.preferences.get, () => this.preferences.get());
    ipcMain.handle(IPC_CHANNELS.preferences.update, async (_event, patch: unknown) => {
      const preferences = await this.preferences.update(patch);
      this.windows.setAppLocale(preferences.appLocale, app.getLocale());
      this.windows.setAlwaysOnTop(preferences.alwaysOnTop);
      this.windows.setMenuDismissBehavior(
        preferences.closeMenuOnEscape,
        preferences.closeMenuOnOutsideClick,
      );
      this.windows.setPictureInPicturePlacement(
        preferences.pictureInPicturePlacement,
      );
      this.windows.setPictureInPictureSize(preferences.pictureInPictureSize);
      this.windows.setPictureInPicturePortraitSize(
        preferences.pictureInPicturePortraitSize,
      );
      this.shortcuts.refreshGlobalShortcut();
      this.updates.configure(preferences);
      await this.sites.refreshCurrentBrowserProfile();
      return preferences;
    });
  }

  dispose(): void {
    ipcMain.off(
      IPC_CHANNELS.overlay.editingChanged,
      this.handleEditingChanged,
    );
    removeIpcHandlers(IPC_HANDLER_CHANNELS);
  }
}

const IPC_HANDLER_CHANNELS = [
  IPC_CHANNELS.sites.list,
  IPC_CHANNELS.application.info,
  IPC_CHANNELS.application.listDisplays,
  IPC_CHANNELS.application.openLink,
  IPC_CHANNELS.application.developerYouTubeStatus,
  IPC_CHANNELS.application.checkForUpdates,
  IPC_CHANNELS.plugins.list,
  IPC_CHANNELS.media.togglePictureInPicture,
  IPC_CHANNELS.media.toggleGamePictureInPicture,
  IPC_CHANNELS.sites.open,
  IPC_CHANNELS.overlay.close,
  IPC_CHANNELS.overlay.setView,
  IPC_CHANNELS.video.openDroppedFiles,
  IPC_CHANNELS.video.getOpenRequest,
  IPC_CHANNELS.downloads.openYouTube,
  IPC_CHANNELS.downloads.status,
  IPC_CHANNELS.downloads.install,
  IPC_CHANNELS.downloads.open,
  IPC_CHANNELS.downloads.openReleasePage,
  IPC_CHANNELS.preferences.get,
  IPC_CHANNELS.preferences.update,
] as const satisfies readonly IpcChannel[];

function removeIpcHandlers(channels: readonly IpcChannel[]): void {
  for (const channel of channels) ipcMain.removeHandler(channel);
}

function isApplicationLinkId(value: unknown): value is ApplicationLinkId {
  return (
    typeof value === 'string' &&
    ['website', 'github', 'discord', 'developerYouTube'].includes(value)
  );
}

function isYouTubeUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(
      host,
    );
  } catch {
    return false;
  }
}
