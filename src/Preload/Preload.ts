import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type ApplicationLinkId,
  type ApplicationInfo,
  type ApplicationDataActionResult,
  type ApplicationUpdateCheckResult,
  type ApplicationUpdatePanelState,
  type AppLocale,
  type AppTheme,
  type BundleInfo,
  type BundleInstallResult,
  type BundleRemoveResult,
  type BundleUpdateResult,
  type DeveloperYouTubeStatus,
  type DevToolsMode,
  type DisplayInfo,
  type KawaikaraRendererApi,
  type OverlayView,
  type PictureInPictureResult,
  type PreferencePatch,
  type PreferenceState,
  type PreferenceUpdateOptions,
  type BundleRuntimeInfo,
  type SiteMenuItem,
  type RendererMessages,
  type VideoDirectoryEntry,
  type VideoDirectoryListing,
  type VideoLibrarySnapshot,
  type VideoPathOpenResult,
} from '../Common/IPC';
import { installVideoDropTarget } from './VideoDrop';
import { installEditableFocusReporter } from './EditableFocus';

installVideoDropTarget();
installEditableFocusReporter();

const api: KawaikaraRendererApi = {
  application: {
    getInfo: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.info) as Promise<ApplicationInfo>,
    getMessages: (locale?: AppLocale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.messages,
        locale,
      ) as Promise<RendererMessages>,
    listDisplays: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.listDisplays,
      ) as Promise<DisplayInfo[]>,
    openLink: (id: ApplicationLinkId) =>
      ipcRenderer.invoke(IPC_CHANNELS.application.openLink, id),
    openDevTools: (mode: DevToolsMode) =>
      ipcRenderer.invoke(IPC_CHANNELS.application.openDevTools, mode),
    openLogDirectory: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.openLogDirectory),
    getDeveloperYouTubeStatus: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.developerYouTubeStatus,
      ) as Promise<DeveloperYouTubeStatus>,
    checkForUpdates: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.checkForUpdates,
      ) as Promise<ApplicationUpdateCheckResult>,
    getUpdateState: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.getUpdateState,
      ) as Promise<ApplicationUpdatePanelState | undefined>,
    downloadUpdate: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.downloadUpdate,
      ) as Promise<ApplicationUpdatePanelState>,
    installUpdate: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.installUpdate),
    copyText: (value) =>
      ipcRenderer.invoke(IPC_CHANNELS.application.copyText, value),
    onUpdateStateChanged: (handler) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: unknown,
      ) => handler(state as ApplicationUpdatePanelState);
      ipcRenderer.on(IPC_CHANNELS.application.updateStateChanged, listener);
      return () =>
        ipcRenderer.off(IPC_CHANNELS.application.updateStateChanged, listener);
    },
    isFullScreen: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.isFullScreen) as Promise<boolean>,
    exitFullScreen: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.exitFullScreen),
  },
  bundles: {
    runtime: () =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.runtime) as Promise<BundleRuntimeInfo[]>,
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.list) as Promise<BundleInfo[]>,
    install: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.bundles.install,
        locale,
      ) as Promise<BundleInstallResult>,
    update: (id, locale) =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.update, id, locale) as Promise<BundleUpdateResult>,
    remove: (id, locale) =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.remove, id, locale) as Promise<BundleRemoveResult>,
  },
  sites: {
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.list) as Promise<SiteMenuItem[]>,
    currentAddress: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.currentAddress) as Promise<string>,
    open: (id) => ipcRenderer.invoke(IPC_CHANNELS.sites.open, id),
    openAddress: (value) =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.openAddress, value),
  },
  videoLibrary: {
    getSnapshot: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.librarySnapshot,
      ) as Promise<VideoLibrarySnapshot>,
    listDirectory: (directory) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.listDirectory,
        directory,
      ) as Promise<VideoDirectoryListing>,
    openPath: (targetPath) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.openPath,
        targetPath,
      ) as Promise<VideoPathOpenResult>,
    searchDirectory: (directory, query) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.searchDirectory,
        directory,
        query,
      ) as Promise<VideoDirectoryEntry[]>,
    setFolderPinned: (directory, pinned) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.pinFolder,
        directory,
        pinned,
      ) as Promise<VideoLibrarySnapshot>,
    removeFolder: (directory) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.removeFolder,
        directory,
      ) as Promise<VideoLibrarySnapshot>,
    openItem: (targetPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.video.openLibraryItem, targetPath),
    getThumbnail: (targetPath) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.thumbnail,
        targetPath,
      ) as Promise<string | undefined>,
  },
  overlay: {
    close: () => ipcRenderer.invoke(IPC_CHANNELS.overlay.close),
    setView: (view: OverlayView) =>
      ipcRenderer.invoke(IPC_CHANNELS.overlay.setView, view),
    onShowMenu: (handler) => {
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.showMenu, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.showMenu, listener);
    },
    onShowPreferences: (handler) => {
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.showPreferences, listener);
      return () =>
        ipcRenderer.off(IPC_CHANNELS.overlay.showPreferences, listener);
    },
    onShowUpdate: (handler) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: unknown,
      ) => handler(state as ApplicationUpdatePanelState);
      ipcRenderer.on(IPC_CHANNELS.overlay.showUpdate, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.showUpdate, listener);
    },
    onRequestClose: (handler) => {
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.requestClose, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.requestClose, listener);
    },
    onHidden: (handler) => {
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.hidden, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.hidden, listener);
    },
  },
  media: {
    togglePictureInPicture: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.media.togglePictureInPicture,
      ) as Promise<PictureInPictureResult>,
    toggleGamePictureInPicture: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.media.toggleGamePictureInPicture,
      ) as Promise<PictureInPictureResult>,
    onPictureInPictureChanged: (
      handler: (result: PictureInPictureResult) => void,
    ) => {
      const listener = (_event: Electron.IpcRendererEvent, result: unknown) => {
        handler(result as PictureInPictureResult);
      };
      ipcRenderer.on(IPC_CHANNELS.media.pictureInPictureChanged, listener);
      return () =>
        ipcRenderer.off(IPC_CHANNELS.media.pictureInPictureChanged, listener);
    },
  },
  preferences: {
    get: () =>
      ipcRenderer.invoke(IPC_CHANNELS.preferences.get) as Promise<PreferenceState>,
    previewTheme: (theme: AppTheme) =>
      ipcRenderer.invoke(IPC_CHANNELS.preferences.previewTheme, theme),
    update: (patch: PreferencePatch, options?: PreferenceUpdateOptions) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.preferences.update,
        patch,
        options,
      ) as Promise<PreferenceState>,
  },
  data: {
    clearBrowserProfile: (profileId, locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.clearBrowserProfile,
        profileId,
        locale,
      ) as Promise<ApplicationDataActionResult>,
    clearIsolatedSite: (siteId, locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.clearIsolatedSite,
        siteId,
        locale,
      ) as Promise<ApplicationDataActionResult>,
    clearApplicationCache: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.clearApplicationCache,
        locale,
      ) as Promise<ApplicationDataActionResult>,
    resetApplication: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.resetApplication,
        locale,
      ) as Promise<ApplicationDataActionResult>,
  },
};

contextBridge.exposeInMainWorld('kawaikara', Object.freeze(api));
