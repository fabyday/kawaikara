import { app, clipboard, ipcMain, type IpcMainEvent } from 'electron';
import { KAWAIKARA_SITE_API_VERSION } from '@kawaikara/site-api';
import {
  IPC_CHANNELS,
  type IpcChannel,
} from '../../Common/IPC';
import { BUILD_CHANNEL } from '../../Common/BuildConfig';
import type { SiteManager } from './SiteManager';
import type { WindowManager } from './WindowManager';
import type { PreferenceManager } from './PreferenceManager';
import type { ExternalDownloaderManager } from './ExternalDownloaderManager';
import type { DeveloperLinkManager } from './DeveloperLinkManager';
import type { UpdateManager } from './UpdateManager';
import type { ShortcutManager } from './ShortcutManager';
import type { VideoLibraryManager } from './VideoLibraryManager';
import type { BundleManager } from './BundleManager';
import type { LoggingManager } from './LoggingManager';
import type { ApplicationDataManager } from './ApplicationDataManager';
import type { BundleDevelopmentManager } from './BundleDevelopmentManager';
import { requireDevelopmentProjectId } from '../Functional/DevelopmentValidation';
import {
  isApplicationLinkId,
  isDevToolsMode,
  isGraphicsRestartConfirmed,
  isYouTubeUrl,
  readRequestedGraphicsMode,
  removeIpcHandlers,
  requireAppLocale,
  requireAppTheme,
  requireIdentifier,
  requirePathString,
  requireSearchQuery,
} from '../Functional/IPCValidation';
import { getRendererMessages } from '../Functional/RendererMessages';

/** Coordinates IPC behavior. */
export class IpcManager {
  /** The relaunch scheduled value. */
  private relaunchScheduled = false;
  /** Callback used to handle dispose development subscription. */
  private disposeDevelopmentSubscription?: () => void;
  /** The handle editing changed value. */
  private readonly handleEditingChanged = (
    event: IpcMainEvent,
    editing: unknown,
  ): void => {
    if (typeof editing !== 'boolean') return;
    this.windows.setEditingState(event.sender.id, editing);
  };
  /** The handle video presentation changed value. */
  private readonly handleVideoPresentationChanged = (
    event: IpcMainEvent,
    state: unknown,
  ): void => {
    this.windows.setInternalVideoPresentation(event.sender.id, state);
  };

  /** Creates an instance of IpcManager. */
  constructor(
    /** The bundles value. */
    private readonly bundles: BundleManager,
    /** The sites value. */
    private readonly sites: SiteManager,
    /** The Windows value. */
    private readonly windows: WindowManager,
    /** The preferences value. */
    private readonly preferences: PreferenceManager,
    /** The downloads value. */
    private readonly downloads: ExternalDownloaderManager,
    /** The developer links value. */
    private readonly developerLinks: DeveloperLinkManager,
    /** The updates value. */
    private readonly updates: UpdateManager,
    /** The shortcuts value. */
    private readonly shortcuts: ShortcutManager,
    /** The video library value. */
    private readonly videoLibrary: VideoLibraryManager,
    /** The logging value. */
    private readonly logging: LoggingManager,
    /** The data value. */
    private readonly data: ApplicationDataManager,
    /** The development value. */
    private readonly development: BundleDevelopmentManager,
  ) {}

  /** Initializes the operation. */
  initialize(): void {
    this.disposeDevelopmentSubscription = this.development.subscribe((state) =>
      this.windows.notifyDevelopmentStateChanged(state),
    );
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
      updateChannelLocked: true,
    }));
    ipcMain.handle(
      IPC_CHANNELS.application.messages,
      (_event, locale: unknown) => {
        const requestedLocale = locale === undefined
          ? this.preferences.get().appLocale
          : requireAppLocale(locale);
        return getRendererMessages(requestedLocale, app.getLocale());
      },
    );
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
    ipcMain.handle(
      IPC_CHANNELS.application.openDevTools,
      (_event, mode: unknown) => {
        if (!isDevToolsMode(mode)) {
          throw new TypeError('Unknown DevTools placement.');
        }
        this.windows.openDevTools(mode);
      },
    );
    ipcMain.handle(
      IPC_CHANNELS.application.openLogDirectory,
      () => this.logging.openDirectory(),
    );
    ipcMain.handle(IPC_CHANNELS.application.developerYouTubeStatus, () =>
      this.developerLinks.getDeveloperYouTubeStatus(),
    );
    ipcMain.handle(
      IPC_CHANNELS.application.checkForUpdates,
      () => this.updates.checkForUpdates(),
    );
    ipcMain.handle(
      IPC_CHANNELS.application.getUpdateState,
      () => this.updates.getState(),
    );
    ipcMain.handle(
      IPC_CHANNELS.application.downloadUpdate,
      () => this.updates.downloadUpdate(),
    );
    ipcMain.handle(
      IPC_CHANNELS.application.installUpdate,
      () => this.updates.installUpdate(),
    );
    ipcMain.handle(
      IPC_CHANNELS.application.copyText,
      (_event, value: unknown) => {
        if (typeof value !== 'string' || value.length > 16_384) {
          throw new TypeError('Clipboard text must be a valid string.');
        }
        clipboard.writeText(value);
      },
    );
    ipcMain.handle(IPC_CHANNELS.bundles.runtime, () => this.sites.listBundles());
    ipcMain.handle(IPC_CHANNELS.bundles.list, () => this.bundles.list());
    ipcMain.handle(
      IPC_CHANNELS.bundles.install,
      (_event, locale: unknown) =>
        this.bundles.installFromDialog(requireAppLocale(locale)),
    );
    ipcMain.handle(
      IPC_CHANNELS.bundles.update,
      (_event, id: unknown, locale: unknown) => {
        if (typeof id !== 'string') throw new TypeError('Bundle id must be a string.');
        return this.bundles.update(id, requireAppLocale(locale));
      },
    );
    ipcMain.handle(
      IPC_CHANNELS.bundles.remove,
      (_event, id: unknown, locale: unknown) => {
        if (typeof id !== 'string') throw new TypeError('Bundle id must be a string.');
        return this.bundles.remove(id, requireAppLocale(locale));
      },
    );
    ipcMain.handle(IPC_CHANNELS.development.state, () =>
      this.development.getState(),
    );
    ipcMain.handle(
      IPC_CHANNELS.development.attach,
      (_event, locale: unknown) =>
        this.development.attachFromDialog(requireAppLocale(locale)),
    );
    ipcMain.handle(
      IPC_CHANNELS.development.rebuild,
      (_event, projectId: unknown) =>
        this.development.rebuild(requireDevelopmentProjectId(projectId)),
    );
    ipcMain.handle(
      IPC_CHANNELS.development.setHotReload,
      (_event, projectId: unknown, enabled: unknown) => {
        if (typeof enabled !== 'boolean') {
          throw new TypeError('Hot reload state must be a boolean.');
        }
        return this.development.setHotReload(
          requireDevelopmentProjectId(projectId),
          enabled,
        );
      },
    );
    ipcMain.handle(
      IPC_CHANNELS.development.detach,
      (_event, projectId: unknown) =>
        this.development.detach(requireDevelopmentProjectId(projectId)),
    );
    ipcMain.handle(IPC_CHANNELS.development.vscodeConfiguration, () =>
      this.development.createVsCodeConfiguration(),
    );
    ipcMain.handle(IPC_CHANNELS.media.togglePictureInPicture, () =>
      this.windows.togglePictureInPicture(),
    );
    ipcMain.handle(IPC_CHANNELS.media.toggleGamePictureInPicture, () =>
      this.windows.toggleGamePictureInPicture(),
    );
    ipcMain.handle(IPC_CHANNELS.sites.list, () => this.sites.listMenuItems());
    ipcMain.handle(IPC_CHANNELS.sites.currentAddress, () =>
      this.windows.getCurrentSiteAddress(),
    );
    ipcMain.handle(IPC_CHANNELS.sites.goBack, () => this.windows.goBack());
    ipcMain.handle(IPC_CHANNELS.sites.goForward, () => this.windows.goForward());
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
      if (view === 'update') {
        const state = this.updates.getState();
        if (!state) throw new Error('No update panel state is available.');
        this.windows.showUpdateOverlay(state);
        return;
      }
      throw new TypeError('Overlay view must be menu, preference, or update.');
    });
    ipcMain.handle(
      IPC_CHANNELS.video.openDroppedFiles,
      async (_event, paths: unknown) => {
        if (!(await this.windows.queueDroppedVideoFiles(paths))) {
          return false;
        }
        this.windows.hideOverlay();
        await this.sites.load('kawaikara.video');
        const request = this.windows.getCurrentVideoOpenRequest();
        if (request?.kind === 'local') {
          await this.videoLibrary.recordVideo(request);
        }
        return true;
      },
    );
    ipcMain.handle(IPC_CHANNELS.application.isFullScreen, () =>
      this.windows.isAppFullScreen(),
    );
    ipcMain.handle(IPC_CHANNELS.application.exitFullScreen, () =>
      this.windows.exitAppFullScreen(),
    );
    ipcMain.handle(IPC_CHANNELS.video.selectLocalFile, async () => {
      const request = await this.windows.selectLocalVideo();
      if (request?.kind === 'local') await this.videoLibrary.recordVideo(request);
      return request;
    });
    ipcMain.handle(
      IPC_CHANNELS.sites.openAddress,
      async (_event, value: unknown) => {
        if (typeof value !== 'string') {
          throw new TypeError('Site address must be a string.');
        }
        const resolved = this.sites.resolveAddress(value);
        if (!resolved) return { status: 'unsupported' as const
        };
        this.windows.hideOverlay();
        await this.sites.openUrl(resolved.siteId, resolved.url);
        return { status: 'opened' as const, siteId: resolved.siteId
        };
      },
    );
    ipcMain.handle(IPC_CHANNELS.video.getPlaybackCapabilities, () =>
      this.windows.getVideoPlaybackCapabilities(),
    );
    ipcMain.handle(IPC_CHANNELS.video.getOpenRequest, () =>
      this.windows.getCurrentVideoOpenRequest(),
    );
    ipcMain.handle(
      IPC_CHANNELS.video.recoverPlaybackRenderer,
      (event) => this.windows.recoverVideoPlaybackRenderer(event.sender.id),
    );
    ipcMain.handle(
      IPC_CHANNELS.video.activateLocalFile,
      async (event, value: unknown) => {
        const result = await this.videoLibrary.openPath(requirePathString(value));
        if (result.kind !== 'video') {
          throw new TypeError('A local video file is required.');
        }
        if (!this.windows.activateVideoOpenRequest(event.sender.id, result.request)) {
          throw new Error('The Video view is no longer active.');
        }
        return result.request;
      },
    );
    ipcMain.on(
      IPC_CHANNELS.video.presentationChanged,
      this.handleVideoPresentationChanged,
    );
    ipcMain.handle(IPC_CHANNELS.video.librarySnapshot, () =>
      this.videoLibrary.getSnapshot(),
    );
    ipcMain.handle(
      IPC_CHANNELS.video.listDirectory,
      (_event, value: unknown) =>
        this.videoLibrary.listDirectory(requirePathString(value)),
    );
    ipcMain.handle(IPC_CHANNELS.video.openPath, (_event, value: unknown) =>
      this.videoLibrary.openPath(requirePathString(value)),
    );
    ipcMain.handle(
      IPC_CHANNELS.video.searchDirectory,
      (_event, directory: unknown, query: unknown) =>
        this.videoLibrary.searchDirectory(
          requirePathString(directory),
          requireSearchQuery(query),
        ),
    );
    ipcMain.handle(
      IPC_CHANNELS.video.pinFolder,
      (_event, value: unknown, pinned: unknown) => {
        if (typeof pinned !== 'boolean') {
          throw new TypeError('Pinned state must be a boolean.');
        }
        return this.videoLibrary.setFolderPinned(
          requirePathString(value),
          pinned,
        );
      },
    );
    ipcMain.handle(
      IPC_CHANNELS.video.removeFolder,
      (_event, value: unknown) =>
        this.videoLibrary.removeFolder(requirePathString(value)),
    );
    ipcMain.handle(
      IPC_CHANNELS.video.openLibraryItem,
      async (_event, value: unknown) => {
        const result = await this.videoLibrary.openPath(requirePathString(value));
        this.windows.queueVideoOpenRequest(
          result.kind === 'directory'
            ? this.videoLibrary.createFolderRequest(result.listing.directory)
            : result.request,
        );
        this.windows.hideOverlay();
        await this.sites.load('kawaikara.video');
      },
    );
    ipcMain.handle(IPC_CHANNELS.video.thumbnail, (_event, value: unknown) =>
      this.videoLibrary.getThumbnail(requirePathString(value)),
    );
    ipcMain.handle(
      IPC_CHANNELS.video.setVolumePreference,
      async (_event, value: unknown) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new TypeError('Video volume must be a finite number.');
        }
        const next = await this.preferences.update({ videoVolume: value
        });
        return next.videoVolume;
      },
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
    ipcMain.handle(
      IPC_CHANNELS.data.clearBrowserProfile,
      (_event, profileId: unknown, locale: unknown) =>
        this.data.clearBrowserProfile(
          requireIdentifier(profileId, 'Browser profile'),
          requireAppLocale(locale),
        ),
    );
    ipcMain.handle(
      IPC_CHANNELS.data.clearIsolatedSite,
      (_event, siteId: unknown, locale: unknown) =>
        this.data.clearIsolatedSite(
          requireIdentifier(siteId, 'Site'),
          requireAppLocale(locale),
        ),
    );
    ipcMain.handle(
      IPC_CHANNELS.data.clearApplicationCache,
      (_event, locale: unknown) =>
        this.data.clearApplicationCache(requireAppLocale(locale)),
    );
    ipcMain.handle(
      IPC_CHANNELS.data.clearAllBrowserProfiles,
      (_event, locale: unknown) =>
        this.data.clearAllBrowserProfiles(requireAppLocale(locale)),
    );
    ipcMain.handle(
      IPC_CHANNELS.data.resetApplication,
      (_event, locale: unknown) =>
        this.data.resetApplication(requireAppLocale(locale)),
    );
    ipcMain.handle(IPC_CHANNELS.preferences.previewTheme, (_event, theme: unknown) => {
      this.windows.setAppTheme(requireAppTheme(theme));
    });
    ipcMain.handle(IPC_CHANNELS.preferences.update, async (
      _event,
      patch: unknown,
      options: unknown,
    ) => {
      const currentGraphicsMode = this.preferences.get().graphicsMode;
      const requestedGraphicsMode = readRequestedGraphicsMode(patch);
      const graphicsModeChanged =
        requestedGraphicsMode !== undefined &&
        requestedGraphicsMode !== currentGraphicsMode;
      if (graphicsModeChanged && !isGraphicsRestartConfirmed(options)) {
        throw new Error(
          'Changing the Electron graphics mode requires an application restart confirmation.',
        );
      }

      const preferences = await this.preferences.update(patch);
      if (graphicsModeChanged) {
        this.scheduleApplicationRelaunch();
        return preferences;
      }

      this.windows.setAppLocale(preferences.appLocale, app.getLocale());
      this.windows.setAppTheme(preferences.appTheme);
      this.windows.setAlwaysOnTop(preferences.alwaysOnTop);
      this.windows.setMenuDismissBehavior(
        preferences.closeMenuOnEscape,
        preferences.closeMenuOnOutsideClick,
      );
      // The startup checkbox is persisted for the next app launch. Saving it
      // must not unexpectedly open DevTools in the current session.
      this.windows.setDevToolsMode(preferences.devToolsMode);
      this.windows.setPictureInPicturePlacement(
        preferences.pictureInPicturePlacement,
      );
      this.windows.setPictureInPictureSize(preferences.pictureInPictureSize);
      this.windows.setPictureInPicturePortraitSize(
        preferences.pictureInPicturePortraitSize,
      );
      this.logging.configureLevel(preferences.logLevel);
      this.shortcuts.refreshGlobalShortcut();
      await this.sites.applyCurrentProviderSettings().catch((error: unknown) => {
        // The preference is already durable. A simultaneous site navigation
        // may destroy the old document before its live update is delivered;
        // the Provider receives the stored value before its next load.
        console.debug('Live Provider settings refresh was skipped.', error);
      });
      this.updates.configure(preferences);
      await this.development.configure(preferences);
      await this.sites.refreshCurrentBrowserProfile();
      return preferences;
    });
  }

  /** Schedules the application relaunch. */
  private scheduleApplicationRelaunch(): void {
    if (this.relaunchScheduled) return;
    this.relaunchScheduled = true;
    // Let ipcRenderer receive the persisted PreferenceState before shutdown.
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 200);
  }

  /** Releases the operation. */
  dispose(): void {
    this.disposeDevelopmentSubscription?.();
    this.disposeDevelopmentSubscription = undefined;
    ipcMain.off(
      IPC_CHANNELS.overlay.editingChanged,
      this.handleEditingChanged,
    );
    ipcMain.off(
      IPC_CHANNELS.video.presentationChanged,
      this.handleVideoPresentationChanged,
    );
    removeIpcHandlers(IPC_HANDLER_CHANNELS);
  }
}

/** Defines the shared IPC handler channels constant. */
const IPC_HANDLER_CHANNELS = [
  IPC_CHANNELS.sites.list,
  IPC_CHANNELS.sites.currentAddress,
  IPC_CHANNELS.sites.goBack,
  IPC_CHANNELS.sites.goForward,
  IPC_CHANNELS.sites.openAddress,
  IPC_CHANNELS.application.info,
  IPC_CHANNELS.application.messages,
  IPC_CHANNELS.application.listDisplays,
  IPC_CHANNELS.application.openLink,
  IPC_CHANNELS.application.openDevTools,
  IPC_CHANNELS.application.openLogDirectory,
  IPC_CHANNELS.application.developerYouTubeStatus,
  IPC_CHANNELS.application.checkForUpdates,
  IPC_CHANNELS.application.getUpdateState,
  IPC_CHANNELS.application.downloadUpdate,
  IPC_CHANNELS.application.installUpdate,
  IPC_CHANNELS.application.isFullScreen,
  IPC_CHANNELS.application.exitFullScreen,
  IPC_CHANNELS.bundles.runtime,
  IPC_CHANNELS.bundles.list,
  IPC_CHANNELS.bundles.install,
  IPC_CHANNELS.bundles.update,
  IPC_CHANNELS.bundles.remove,
  IPC_CHANNELS.development.state,
  IPC_CHANNELS.development.attach,
  IPC_CHANNELS.development.rebuild,
  IPC_CHANNELS.development.setHotReload,
  IPC_CHANNELS.development.detach,
  IPC_CHANNELS.development.vscodeConfiguration,
  IPC_CHANNELS.media.togglePictureInPicture,
  IPC_CHANNELS.media.toggleGamePictureInPicture,
  IPC_CHANNELS.sites.open,
  IPC_CHANNELS.overlay.close,
  IPC_CHANNELS.overlay.setView,
  IPC_CHANNELS.video.openDroppedFiles,
  IPC_CHANNELS.video.selectLocalFile,
  IPC_CHANNELS.video.getPlaybackCapabilities,
  IPC_CHANNELS.video.getOpenRequest,
  IPC_CHANNELS.video.recoverPlaybackRenderer,
  IPC_CHANNELS.video.activateLocalFile,
  IPC_CHANNELS.video.librarySnapshot,
  IPC_CHANNELS.video.listDirectory,
  IPC_CHANNELS.video.openPath,
  IPC_CHANNELS.video.searchDirectory,
  IPC_CHANNELS.video.pinFolder,
  IPC_CHANNELS.video.removeFolder,
  IPC_CHANNELS.video.openLibraryItem,
  IPC_CHANNELS.video.thumbnail,
  IPC_CHANNELS.video.setVolumePreference,
  IPC_CHANNELS.downloads.openYouTube,
  IPC_CHANNELS.downloads.status,
  IPC_CHANNELS.downloads.install,
  IPC_CHANNELS.downloads.open,
  IPC_CHANNELS.downloads.openReleasePage,
  IPC_CHANNELS.preferences.get,
  IPC_CHANNELS.data.clearBrowserProfile,
  IPC_CHANNELS.data.clearIsolatedSite,
  IPC_CHANNELS.data.clearAllBrowserProfiles,
  IPC_CHANNELS.data.clearApplicationCache,
  IPC_CHANNELS.data.resetApplication,
  IPC_CHANNELS.preferences.previewTheme,
  IPC_CHANNELS.preferences.update,
] as const satisfies readonly IpcChannel[];
