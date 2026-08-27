import { contextBridge, ipcRenderer } from 'electron';
import { exposeMpvApi } from 'electron-mpv-video/preload';
import {
  IPC_CHANNELS,
  type AppLocale,
  type KawaikaraVideoApi,
  type PreferenceState,
  type VideoDirectoryEntry,
  type VideoDirectoryListing,
  type VideoLibrarySnapshot,
  type VideoPlaybackCapabilities,
  type VideoOpenRequest,
  type VideoPathOpenResult,
  type RendererMessages,
} from '../Common/IPC';
import { installVideoDropTarget } from './VideoDrop';
import { installEditableFocusReporter } from './EditableFocus';

installVideoDropTarget();
installEditableFocusReporter();
installScrollbarTheme();

if (window.location.protocol === 'file:') {
  exposeMpvApi();
  const api: KawaikaraVideoApi = {
    application: {
      getMessages: (locale?: AppLocale) =>
        ipcRenderer.invoke(
          IPC_CHANNELS.application.messages,
          locale,
        ) as Promise<RendererMessages>,
      isFullScreen: () =>
        ipcRenderer.invoke(
          IPC_CHANNELS.application.isFullScreen,
        ) as Promise<boolean>,
      exitFullScreen: () =>
        ipcRenderer.invoke(IPC_CHANNELS.application.exitFullScreen),
      togglePictureInPicture: () =>
        ipcRenderer.invoke(IPC_CHANNELS.media.togglePictureInPicture),
      recoverPlaybackRenderer: () =>
        ipcRenderer.invoke(
          IPC_CHANNELS.video.recoverPlaybackRenderer,
        ) as Promise<boolean>,
      onFullScreenChanged: (handler) => {
        /** Performs the listener operation. */
        const listener = (
          _event: Electron.IpcRendererEvent,
          fullScreen: boolean,
        ) => handler(fullScreen);
        ipcRenderer.on(IPC_CHANNELS.application.fullScreenChanged, listener);
        return () =>
          ipcRenderer.off(IPC_CHANNELS.application.fullScreenChanged, listener);
      },
      onPictureInPictureChanged: (handler) => {
        /** Performs the listener operation. */
        const listener = (
          _event: Electron.IpcRendererEvent,
          active: boolean,
        ) => handler(active);
        ipcRenderer.on(IPC_CHANNELS.video.pictureInPictureChanged, listener);
        return () =>
          ipcRenderer.off(IPC_CHANNELS.video.pictureInPictureChanged, listener);
      },
      onVisibilityChanged: (handler) => {
        /** Performs the listener operation. */
        const listener = (
          _event: Electron.IpcRendererEvent,
          visible: boolean,
        ) => handler(visible);
        ipcRenderer.on(IPC_CHANNELS.video.visibilityChanged, listener);
        return () =>
          ipcRenderer.off(IPC_CHANNELS.video.visibilityChanged, listener);
      },
    },
    source: {
      selectLocalFile: () =>
        ipcRenderer.invoke(
          IPC_CHANNELS.video.selectLocalFile,
        ) as Promise<VideoOpenRequest | null>,
      getPlaybackCapabilities: () =>
        ipcRenderer.invoke(
          IPC_CHANNELS.video.getPlaybackCapabilities,
        ) as Promise<VideoPlaybackCapabilities>,
      getOpenRequest: () =>
        ipcRenderer.invoke(
          IPC_CHANNELS.video.getOpenRequest,
        ) as Promise<VideoOpenRequest | null>,
      activateLocalFile: (targetPath) =>
        ipcRenderer.invoke(
          IPC_CHANNELS.video.activateLocalFile,
          targetPath,
        ) as Promise<Extract<VideoOpenRequest, { readonly kind: 'local'
        }>>,
      onOpenRequest: (handler) => {
        /** Performs the listener operation. */
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
    preferences: {
      get: () =>
        ipcRenderer.invoke(
          IPC_CHANNELS.preferences.get,
        ) as Promise<PreferenceState>,
      setVideoVolume: async (value) => {
        return ipcRenderer.invoke(
          IPC_CHANNELS.video.setVolumePreference,
          value,
        ) as Promise<number>;
      },
    },
    presentation: {
      update: (state) =>
        ipcRenderer.send(IPC_CHANNELS.video.presentationChanged, state),
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
  };
  contextBridge.exposeInMainWorld('kawaikaraVideo', Object.freeze(api));
} else {
  installExternalLoginGate();
  installYouTubeDownloadMenu();
}

/** Installs the external login gate. */
function installExternalLoginGate(): void {
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  const configuration = hostname === 'netflix.com' || hostname.endsWith('.netflix.com')
    ? {
        selector:
          '[data-uia*="login" i], a[href*="/login" i], button[aria-label*="login" i], button[aria-label*="sign in" i]',
        labels: ['sign in', 'log in', 'login', '로그인', 'ログイン'],
      }
    : hostname === 'coupangplay.com' || hostname.endsWith('.coupangplay.com')
      ? {
          selector:
            '[data-cy*="login" i], [data-testid*="login" i], a[href*="/login" i], button[aria-label*="login" i]',
          labels: ['sign in', 'log in', 'login', '로그인', 'ログイン'],
        }
      : undefined;
  if (!configuration) return;

  /** Determines whether the login control condition applies. */
  const isLoginControl = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    if (target.closest(configuration.selector)) return true;
    const candidate = target.closest('a,button,[role="button"]');
    if (!candidate) return false;
    const label = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.textContent,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return configuration.labels.some((fallback) => label.includes(fallback));
  };

  document.addEventListener(
    'click',
    (event) => {
      if (
        document.documentElement?.dataset.kawaikaraExternalLoginReady === 'true' ||
        !isLoginControl(event.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  /** Installs the waiting style. */
  const installWaitingStyle = () => {
    if (document.getElementById('kawaikara-external-login-gate')) return;
    const style = document.createElement('style');
    style.id = 'kawaikara-external-login-gate';
    style.textContent = `${configuration.selector} {
      cursor: wait !important;
      filter: saturate(.35) !important;
      opacity: .72 !important;
    }`;
    (document.head ?? document.documentElement).append(style);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWaitingStyle, { once: true
    });
  } else {
    installWaitingStyle();
  }
}

/** Installs the you tube download menu. */
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

/** Installs the scrollbar theme. */
function installScrollbarTheme(): void {
  const styleId = 'kawaikara-scrollbar-theme';
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;

  /** Installs the operation. */
  const install = () => {
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        :root {
          scrollbar-color: transparent transparent !important;
          scrollbar-width: auto !important;
        }
        *::-webkit-scrollbar {
          width: 12px !important;
          height: 12px !important;
        }
        *::-webkit-scrollbar-track {
          background: transparent !important;
        }
        *::-webkit-scrollbar-button,
        *::-webkit-scrollbar-button:single-button {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          -webkit-appearance: none !important;
          background: transparent !important;
        }
        *::-webkit-scrollbar-corner {
          background: transparent !important;
        }
        *::-webkit-scrollbar-thumb {
          border: 2px solid transparent !important;
          border-radius: 999px !important;
          background: transparent !important;
          background-clip: padding-box !important;
          transition: background-color 180ms ease !important;
        }
        html[data-kawaikara-scrolling="true"] {
          scrollbar-color: rgb(161 161 170 / 58%) transparent !important;
        }
        html[data-kawaikara-scrolling="true"]::-webkit-scrollbar-thumb,
        html[data-kawaikara-scrolling="true"] *::-webkit-scrollbar-thumb {
          background-color: rgb(161 161 170 / 58%) !important;
        }
      `;
      (document.head ?? document.documentElement).append(style);
    }
  };

  /** Performs the show scrollbar operation. */
  const showScrollbar = () => {
    document.documentElement?.setAttribute('data-kawaikara-scrolling', 'true');
    if (fadeTimer !== undefined) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      fadeTimer = undefined;
      document.documentElement?.removeAttribute('data-kawaikara-scrolling');
    }, 850);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true
    });
  } else {
    install();
  }
  document.addEventListener('scroll', showScrollbar, true);
}

/** Schedules the download menu item. */
function scheduleDownloadMenuItem(attempt = 0): void {
  window.setTimeout(() => {
    if (!appendDownloadMenuItem() && attempt < 12) {
      scheduleDownloadMenuItem(attempt + 1);
    }
  }, attempt === 0 ? 0 : 40);
}

/** Performs the append download menu item operation. */
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

  /** Opens the downloader. */
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
