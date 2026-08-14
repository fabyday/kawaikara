import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type ApplicationLinkId,
  type ApplicationInfo,
  type ApplicationUpdateCheckResult,
  type DeveloperYouTubeStatus,
  type DisplayInfo,
  type KawaikaraRendererApi,
  type OverlayView,
  type PictureInPictureResult,
  type PreferencePatch,
  type PreferenceState,
  type PluginInfo,
  type SiteMenuItem,
} from '../Common/IPC';
import { installVideoDropTarget } from './VideoDrop';
import { installEditableFocusReporter } from './EditableFocus';

installVideoDropTarget();
installEditableFocusReporter();

const api: KawaikaraRendererApi = {
  application: {
    getInfo: () =>
      ipcRenderer.invoke(IPC_CHANNELS.application.info) as Promise<ApplicationInfo>,
    listDisplays: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.listDisplays,
      ) as Promise<DisplayInfo[]>,
    openLink: (id: ApplicationLinkId) =>
      ipcRenderer.invoke(IPC_CHANNELS.application.openLink, id),
    getDeveloperYouTubeStatus: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.developerYouTubeStatus,
      ) as Promise<DeveloperYouTubeStatus>,
    checkForUpdates: (channel) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.application.checkForUpdates,
        channel,
      ) as Promise<ApplicationUpdateCheckResult>,
  },
  plugins: {
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.list) as Promise<PluginInfo[]>,
  },
  sites: {
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.sites.list) as Promise<SiteMenuItem[]>,
    open: (id) => ipcRenderer.invoke(IPC_CHANNELS.sites.open, id),
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
