import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type KawaikaraVideoApi,
  type VideoOpenRequest,
} from '../Common/IPC';
import { installVideoDropTarget } from './VideoDrop';
import { installEditableFocusReporter } from './EditableFocus';

installVideoDropTarget();
installEditableFocusReporter();

if (window.location.protocol === 'file:') {
  const api: KawaikaraVideoApi = {
    source: {
      getOpenRequest: () =>
        ipcRenderer.invoke(
          IPC_CHANNELS.video.getOpenRequest,
        ) as Promise<VideoOpenRequest | null>,
      onOpenRequest: (handler) => {
        const listener = (
          _event: Electron.IpcRendererEvent,
          request: VideoOpenRequest,
        ) => handler(request);
        ipcRenderer.on(IPC_CHANNELS.video.openRequestChanged, listener);
        return () =>
          ipcRenderer.off(IPC_CHANNELS.video.openRequestChanged, listener);
      },
    },
    downloads: {
      getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.downloads.status),
      install: (url) => ipcRenderer.invoke(IPC_CHANNELS.downloads.install, url),
      open: (url) => ipcRenderer.invoke(IPC_CHANNELS.downloads.open, url),
      openReleasePage: () =>
        ipcRenderer.invoke(IPC_CHANNELS.downloads.openReleasePage),
    },
  };
  contextBridge.exposeInMainWorld('kawaikaraVideo', Object.freeze(api));
} else {
  installYouTubeDownloadMenu();
}

function installYouTubeDownloadMenu(): void {
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  if (hostname !== 'youtube.com' && hostname !== 'm.youtube.com') {
    return;
  }

  document.addEventListener(
    'contextmenu',
    () => {
      scheduleDownloadMenuItem();
    },
    true,
  );
}

function scheduleDownloadMenuItem(attempt = 0): void {
  window.setTimeout(() => {
    if (!appendDownloadMenuItem() && attempt < 12) {
      scheduleDownloadMenuItem(attempt + 1);
    }
  }, attempt === 0 ? 0 : 40);
}

function appendDownloadMenuItem(): boolean {
  const menu = document.querySelector<HTMLElement>(
    '.ytp-popup.ytp-contextmenu .ytp-panel-menu',
  );
  if (!menu) {
    return false;
  }
  if (menu.querySelector('[data-kawaikara-youtube-download]')) {
    return true;
  }

  const item = document.createElement('div');
  item.className = 'ytp-menuitem';
  item.dataset.kawaikaraYoutubeDownload = 'true';
  item.setAttribute('role', 'menuitem');
  item.tabIndex = 0;

  const icon = document.createElement('div');
  icon.className = 'ytp-menuitem-icon';
  icon.textContent = '↓';
  icon.style.cssText =
    'display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff';

  const label = document.createElement('div');
  label.className = 'ytp-menuitem-label';
  label.textContent = 'Download with Kawaikara';

  const content = document.createElement('div');
  content.className = 'ytp-menuitem-content';
  item.append(icon, label, content);

  const openDownloader = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    menu.closest<HTMLElement>('.ytp-contextmenu')?.style.setProperty('display', 'none');
    void ipcRenderer.invoke(
      IPC_CHANNELS.downloads.openYouTube,
      window.location.href,
    );
  };
  item.addEventListener('click', openDownloader);
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      openDownloader(event);
    }
  });
  menu.append(item);
  return true;
}
