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
  type DevelopmentBundleAttachResult,
  type DevelopmentState,
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

/** Stores the API value. */
const api: KawaikaraRendererApi = {
  /** The application value. */
  application: {
    /** The get info value. */
    getInfo: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.info) as Promise<ApplicationInfo>,
    /** The get messages value. */
    getMessages: (locale?: AppLocale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.messages,
        locale,
      ) as Promise<RendererMessages>,
    /** The list displays value. */
    listDisplays: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.listDisplays,
      ) as Promise<DisplayInfo[]>,
    /** The open link value. */
    openLink: (id: ApplicationLinkId) =>
      ipcRenderer.invoke(IPC_CHANNELS.application.openLink, id),
    /** The open dev tools value. */
    openDevTools: (mode: DevToolsMode) =>
      ipcRenderer.invoke(IPC_CHANNELS.application.openDevTools, mode),
    /** The open log directory value. */
    openLogDirectory: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.openLogDirectory),
    /** The get developer you tube status value. */
    getDeveloperYouTubeStatus: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.developerYouTubeStatus,
      ) as Promise<DeveloperYouTubeStatus>,
    /** The check for updates value. */
    checkForUpdates: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.checkForUpdates,
      ) as Promise<ApplicationUpdateCheckResult>,
    /** The get update state value. */
    getUpdateState: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.getUpdateState,
      ) as Promise<ApplicationUpdatePanelState | undefined>,
    /** The download update value. */
    downloadUpdate: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.downloadUpdate,
      ) as Promise<ApplicationUpdatePanelState>,
    /** The install update value. */
    installUpdate: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.installUpdate),
    /** The copy text value. */
    copyText: (value) =>
      ipcRenderer.invoke(IPC_CHANNELS.application.copyText, value),
    /** The on update state changed value. */
    onUpdateStateChanged: (handler) => {
      /** Performs the listener operation. */
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: unknown,
      ) => handler(state as ApplicationUpdatePanelState);
      ipcRenderer.on(IPC_CHANNELS.application.updateStateChanged, listener);
      return () =>
        ipcRenderer.off(IPC_CHANNELS.application.updateStateChanged, listener);
    },
    /** Whether the full screen option is enabled. */
    isFullScreen: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.isFullScreen) as Promise<boolean>,
    /** The exit full screen value. */
    exitFullScreen: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.exitFullScreen),
  },
  /** The bundles value. */
  bundles: {
    /** The runtime value. */
    runtime: () =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.runtime) as Promise<BundleRuntimeInfo[]>,
    /** The list value. */
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.list) as Promise<BundleInfo[]>,
    /** The install value. */
    install: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.bundles.install,
        locale,
      ) as Promise<BundleInstallResult>,
    /** The update value. */
    update: (id, locale) =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.update, id, locale) as Promise<BundleUpdateResult>,
    /** The remove value. */
    remove: (id, locale) =>
      ipcRenderer.invoke(IPC_CHANNELS.bundles.remove, id, locale) as Promise<BundleRemoveResult>,
  },
  /** The development value. */
  development: {
    /** The get state value. */
    getState: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.development.state,
      ) as Promise<DevelopmentState>,
    /** The attach value. */
    attach: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.development.attach,
        locale,
      ) as Promise<DevelopmentBundleAttachResult>,
    /** The rebuild value. */
    rebuild: (projectId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.development.rebuild,
        projectId,
      ) as Promise<DevelopmentState>,
    /** The set hot reload value. */
    setHotReload: (projectId, enabled) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.development.setHotReload,
        projectId,
        enabled,
      ) as Promise<DevelopmentState>,
    /** The detach value. */
    detach: (projectId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.development.detach,
        projectId,
      ) as Promise<DevelopmentState>,
    /** The get vs code configuration value. */
    getVsCodeConfiguration: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.development.vscodeConfiguration,
      ) as Promise<string>,
    /** The on state changed value. */
    onStateChanged: (handler) => {
      /** Performs the listener operation. */
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: unknown,
      ) => handler(state as DevelopmentState);
      ipcRenderer.on(IPC_CHANNELS.development.stateChanged, listener);
      return () =>
        ipcRenderer.off(IPC_CHANNELS.development.stateChanged, listener);
    },
  },
  /** The sites value. */
  sites: {
    /** The list value. */
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.list) as Promise<SiteMenuItem[]>,
    /** The current address value. */
    currentAddress: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.currentAddress) as Promise<string>,
    /** The go back value. */
    goBack: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.goBack) as Promise<boolean>,
    /** The go forward value. */
    goForward: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.goForward) as Promise<boolean>,
    /** The open value. */
    open: (id) => ipcRenderer.invoke(IPC_CHANNELS.sites.open, id),
    /** The open address value. */
    openAddress: (value) =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.openAddress, value),
  },
  /** The video library value. */
  videoLibrary: {
    /** The get snapshot value. */
    getSnapshot: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.librarySnapshot,
      ) as Promise<VideoLibrarySnapshot>,
    /** The list directory value. */
    listDirectory: (directory) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.listDirectory,
        directory,
      ) as Promise<VideoDirectoryListing>,
    /** The open path value. */
    openPath: (targetPath) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.openPath,
        targetPath,
      ) as Promise<VideoPathOpenResult>,
    /** The search directory value. */
    searchDirectory: (directory, query) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.searchDirectory,
        directory,
        query,
      ) as Promise<VideoDirectoryEntry[]>,
    /** The set folder pinned value. */
    setFolderPinned: (directory, pinned) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.pinFolder,
        directory,
        pinned,
      ) as Promise<VideoLibrarySnapshot>,
    /** The remove folder value. */
    removeFolder: (directory) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.removeFolder,
        directory,
      ) as Promise<VideoLibrarySnapshot>,
    /** The open item value. */
    openItem: (targetPath) =>
      ipcRenderer.invoke(IPC_CHANNELS.video.openLibraryItem, targetPath),
    /** The get thumbnail value. */
    getThumbnail: (targetPath) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.video.thumbnail,
        targetPath,
      ) as Promise<string | undefined>,
  },
  /** The overlay value. */
  overlay: {
    /** The close value. */
    close: () => ipcRenderer.invoke(IPC_CHANNELS.overlay.close),
    /** The set view value. */
    setView: (view: OverlayView) =>
      ipcRenderer.invoke(IPC_CHANNELS.overlay.setView, view),
    /** The on show menu value. */
    onShowMenu: (handler) => {
      /** Performs the listener operation. */
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.showMenu, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.showMenu, listener);
    },
    /** The on show preferences value. */
    onShowPreferences: (handler) => {
      /** Performs the listener operation. */
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.showPreferences, listener);
      return () =>
        ipcRenderer.off(IPC_CHANNELS.overlay.showPreferences, listener);
    },
    /** The on show update value. */
    onShowUpdate: (handler) => {
      /** Performs the listener operation. */
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: unknown,
      ) => handler(state as ApplicationUpdatePanelState);
      ipcRenderer.on(IPC_CHANNELS.overlay.showUpdate, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.showUpdate, listener);
    },
    /** The on request close value. */
    onRequestClose: (handler) => {
      /** Performs the listener operation. */
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.requestClose, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.requestClose, listener);
    },
    /** The on hidden value. */
    onHidden: (handler) => {
      /** Performs the listener operation. */
      const listener = () => handler();
      ipcRenderer.on(IPC_CHANNELS.overlay.hidden, listener);
      return () => ipcRenderer.off(IPC_CHANNELS.overlay.hidden, listener);
    },
  },
  /** The media value. */
  media: {
    /** The toggle picture in picture value. */
    togglePictureInPicture: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.media.togglePictureInPicture,
      ) as Promise<PictureInPictureResult>,
    /** The toggle game picture in picture value. */
    toggleGamePictureInPicture: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.media.toggleGamePictureInPicture,
      ) as Promise<PictureInPictureResult>,
    /** The on picture in picture changed value. */
    onPictureInPictureChanged: (
      handler: (result: PictureInPictureResult) => void,
    ) => {
      /** Performs the listener operation. */
      const listener = (_event: Electron.IpcRendererEvent, result: unknown) => {
        handler(result as PictureInPictureResult);
      };
      ipcRenderer.on(IPC_CHANNELS.media.pictureInPictureChanged, listener);
      return () =>
        ipcRenderer.off(IPC_CHANNELS.media.pictureInPictureChanged, listener);
    },
  },
  /** The preferences value. */
  preferences: {
    /** The get value. */
    get: () =>
      ipcRenderer.invoke(IPC_CHANNELS.preferences.get) as Promise<PreferenceState>,
    /** The preview theme value. */
    previewTheme: (theme: AppTheme) =>
      ipcRenderer.invoke(IPC_CHANNELS.preferences.previewTheme, theme),
    /** The update value. */
    update: (patch: PreferencePatch, options?: PreferenceUpdateOptions) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.preferences.update,
        patch,
        options,
      ) as Promise<PreferenceState>,
  },
  /** The data value. */
  data: {
    /** The clear browser profile value. */
    clearBrowserProfile: (profileId, locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.clearBrowserProfile,
        profileId,
        locale,
      ) as Promise<ApplicationDataActionResult>,
    /** The clear isolated site value. */
    clearIsolatedSite: (siteId, locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.clearIsolatedSite,
        siteId,
        locale,
      ) as Promise<ApplicationDataActionResult>,
    /** The clear all browser profiles value. */
    clearAllBrowserProfiles: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.clearAllBrowserProfiles,
        locale,
      ) as Promise<ApplicationDataActionResult>,
    /** The clear application cache value. */
    clearApplicationCache: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.clearApplicationCache,
        locale,
      ) as Promise<ApplicationDataActionResult>,
    /** The reset application value. */
    resetApplication: (locale) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.data.resetApplication,
        locale,
      ) as Promise<ApplicationDataActionResult>,
  },
};

contextBridge.exposeInMainWorld('kawaikara', Object.freeze(api));
