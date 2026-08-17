import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type ApplicationLinkId,
  type ApplicationInfo,
  type ApplicationUpdateCheckResult,
  type AppLocale,
  type DeveloperYouTubeStatus,
  type DevToolsMode,
  type DisplayInfo,
  type KawaikaraRendererApi,
  type OverlayView,
  type PictureInPictureResult,
  type PreferencePatch,
  type PreferenceState,
  type PluginInfo,
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
    checkForUpdates: (channel) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.checkForUpdates,
        channel,
      ) as Promise<ApplicationUpdateCheckResult>,
    isFullScreen: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.isFullScreen) as Promise<boolean>,
    exitFullScreen: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.exitFullScreen),
  },
  plugins: {
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.list) as Promise<PluginInfo[]>,
  },
  sites: {
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.list) as Promise<SiteMenuItem[]>,
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
    update: (patch: PreferencePatch) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.preferences.update,
        patch,
      ) as Promise<PreferenceState>,
  },
};

contextBridge.exposeInMainWorld('kawaikara', Object.freeze(api));
