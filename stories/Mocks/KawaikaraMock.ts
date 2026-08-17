import type {
  KawaikaraRendererApi,
  KawaikaraVideoApi,
  PreferenceState,
  SiteMenuItem,
  VideoLibraryApi,
} from '../../src/Common/IPC';
import type { ReleaseChannel } from '../../src/Common/BuildConfig';
import {
  DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  DEFAULT_PICTURE_IN_PICTURE_SIZE,
} from '../../src/Common/PictureInPicture';
import { getRendererMessages } from '../../src/Main/Functional/RendererMessages';

export const STORY_MESSAGES = getRendererMessages('system', 'en-US');

const svgIcon = (label: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="${color}" />
      <text x="32" y="41" text-anchor="middle" font-family="system-ui" font-size="28" font-weight="700" fill="white">${label}</text>
    </svg>
  `)}`;

export const STORY_SITES: SiteMenuItem[] = [
  {
    id: 'kawaikara.netflix',
    pluginId: 'kawaikara.builtin-sites',
    title: 'Netflix',
    category: 'OTT',
    icon: svgIcon('N', '#e50914'),
    order: 10,
    defaultShortcut: 'Control+Alt+1',
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    defaultLocale: 'inherit',
    drm: true,
    isCurrent: false,
  },
  {
    id: 'kawaikara.laftel',
    pluginId: 'kawaikara.builtin-sites',
    title: 'Laftel',
    category: 'OTT',
    icon: svgIcon('L', '#6d5dfc'),
    order: 20,
    defaultShortcut: 'Control+Alt+2',
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    defaultLocale: 'inherit',
    drm: false,
    isCurrent: false,
  },
  {
    id: 'kawaikara.coupang-play',
    pluginId: 'kawaikara.builtin-sites',
    title: 'Coupang Play',
    category: 'OTT',
    icon: svgIcon('C', '#00a8ff'),
    order: 30,
    defaultShortcut: 'Control+Alt+9',
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    defaultLocale: 'inherit',
    drm: true,
    isCurrent: false,
  },
  {
    id: 'kawaikara.video',
    pluginId: 'kawaikara.builtin-sites',
    title: 'Video',
    category: 'Video',
    panelId: 'video-library',
    order: 0,
    defaultShortcut: 'Control+Alt+4',
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    defaultLocale: 'inherit',
    drm: false,
    isCurrent: false,
  },
  {
    id: 'kawaikara.youtube',
    pluginId: 'kawaikara.builtin-sites',
    title: 'YouTube',
    category: 'Video',
    icon: svgIcon('▶', '#ff0033'),
    order: 10,
    defaultShortcut: 'Control+Alt+5',
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    defaultLocale: 'inherit',
    defaultBrowserProfileId: 'plugin:kawaikara.builtin-sites:google',
    drm: false,
    isCurrent: true,
  },
  {
    id: 'kawaikara.spotify',
    pluginId: 'kawaikara.builtin-sites',
    title: 'Spotify',
    category: 'Music',
    icon: svgIcon('S', '#1db954'),
    order: 10,
    defaultShortcut: 'Control+Alt+S',
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    defaultLocale: 'inherit',
    drm: false,
    isCurrent: false,
  },
];

const DEFAULT_PREFERENCES: PreferenceState = {
  alwaysOnTop: false,
  openMenuOnStartup: true,
  closeMenuOnEscape: true,
  closeMenuOnOutsideClick: true,
  automaticUpdates: false,
  updateChannel: 'staging',
  defaultSiteId: 'kawaikara.youtube',
  devToolsMode: 'detach',
  appLocale: 'system',
  appTheme: 'dark',
  pictureInPicturePlacement: DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  pictureInPicturePortraitSize: DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  pictureInPictureSize: DEFAULT_PICTURE_IN_PICTURE_SIZE,
  pluginLocales: {},
  siteLocales: {},
  browserProfiles: [],
  siteBrowserProfiles: {},
  menuCategoryOrder: [],
  menuSiteOrder: [],
  videoSeekSeconds: 10,
  videoOverlayHideSeconds: 1.8,
  videoControlsLayout: 'inline',
  videoVolume: 100,
  logLevel: 'info',
  shortcuts: {},
};

export interface KawaikaraMockOptions {
  readonly buildChannel?: ReleaseChannel;
  readonly currentSiteId?: string;
  readonly updateAvailable?: boolean;
}

export function installKawaikaraMock(
  options: KawaikaraMockOptions = {},
): KawaikaraRendererApi {
  const buildChannel = options.buildChannel ?? 'staging';
  const appVersion = {
    stable: '3.0.0',
    staging: '3.0.0-staging.12',
    nightly: '3.0.0-nightly.12',
  }[buildChannel];
  const nextVersion = {
    stable: '3.0.1',
    staging: '3.0.0-staging.13',
    nightly: '3.0.0-nightly.13',
  }[buildChannel];
  let preferences = {
    ...DEFAULT_PREFERENCES,
    updateChannel: buildChannel,
  };
  let overlayVisible = false;
  let currentSiteId = options.currentSiteId ?? 'kawaikara.youtube';
  const hiddenHandlers = new Set<() => void>();
  const menuHandlers = new Set<() => void>();
  const preferenceHandlers = new Set<() => void>();
  const requestCloseHandlers = new Set<() => void>();

  const emitHidden = () => {
    overlayVisible = false;
    hiddenHandlers.forEach((handler) => handler());
  };

  const emitMenu = () => {
    overlayVisible = true;
    menuHandlers.forEach((handler) => handler());
  };

  const videoLibrary: VideoLibraryApi = {
    getSnapshot: async () => ({
      lastDirectory: '/Users/kawaikara/Movies',
      locations: [
        { kind: 'system', name: 'Movies', path: '/Users/kawaikara/Movies' },
      ],
      favoriteFolders: [
        {
          name: 'Movies',
          path: '/Users/kawaikara/Movies',
          pinned: true,
          lastOpenedAt: new Date().toISOString(),
        },
      ],
      recentFolders: [
        {
          name: 'Movies',
          path: '/Users/kawaikara/Movies',
          pinned: true,
          lastOpenedAt: new Date().toISOString(),
        },
      ],
      recentVideos: [
        {
          name: 'sample.mkv',
          path: '/Users/kawaikara/Movies/sample.mkv',
          directory: '/Users/kawaikara/Movies',
          lastOpenedAt: new Date().toISOString(),
        },
      ],
    }),
    listDirectory: async (directory) => ({
      directory,
      displayName: 'Movies',
      parent: '/Users/kawaikara',
      entries: [
        {
          kind: 'video',
          name: 'sample.mkv',
          path: `${directory}/sample.mkv`,
          size: 1_048_576,
        },
      ],
    }),
    openPath: async (target) => {
      if (/\.[a-z0-9]{2,5}$/i.test(target)) {
        const directory = target.replace(/\/[^/]+$/, '') || '/';
        return {
          kind: 'video',
          directory,
          request: {
            kind: 'local',
            displayName: target.split('/').at(-1) ?? target,
            directory,
            path: target,
            url: `file://${target}`,
          },
        };
      }
      return {
        kind: 'directory',
        listing: await videoLibrary.listDirectory(target),
      };
    },
    searchDirectory: async (directory, query) => [
      {
        kind: 'video',
        name: `${query || 'sample'}.mkv`,
        path: `${directory}/${query || 'sample'}.mkv`,
        size: 1_048_576,
      },
    ],
    setFolderPinned: async () => videoLibrary.getSnapshot(),
    removeFolder: async () => videoLibrary.getSnapshot(),
    openItem: async () => undefined,
    getThumbnail: async () => undefined,
  };

  const api: KawaikaraRendererApi = {
    application: {
      getInfo: async () => ({
        name: 'Kawaikara',
        version: appVersion,
        siteApiVersion: 1,
        electronVersion: '35.2.2',
        chromeVersion: '134.0.0.0',
        platform: 'darwin',
        arch: 'arm64',
        buildChannel,
        updateChannelLocked: buildChannel === 'nightly',
      }),
      getMessages: async (locale) =>
        getRendererMessages(locale ?? preferences.appLocale, 'en-US'),
      listDisplays: async () => [
        {
          id: '1',
          label: 'Built-in Retina Display',
          width: 2560,
          height: 1440,
          scaleFactor: 2,
          primary: true,
          current: true,
        },
        {
          id: '2',
          label: 'Studio Display',
          width: 2560,
          height: 1440,
          scaleFactor: 2,
          primary: false,
          current: false,
        },
      ],
      openLink: async () => undefined,
      openDevTools: async () => undefined,
      openLogDirectory: async () => undefined,
      getDeveloperYouTubeStatus: async () => ({
        isLive: true,
        checkedAt: new Date().toISOString(),
      }),
      checkForUpdates: async () => ({
        status: options.updateAvailable ? 'update-available' : 'up-to-date',
        channel: preferences.updateChannel,
        currentVersion: appVersion,
        latestVersion: options.updateAvailable
          ? nextVersion
          : appVersion,
      }),
      isFullScreen: async () => false,
      exitFullScreen: async () => undefined,
    },
    plugins: {
      list: async () => [
        {
          id: 'kawaikara.builtin-sites',
          name: 'Kawaikara Built-in Sites',
          description: 'Official site descriptors bundled with Kawaikara.',
          version: '3.0.0-dev.0',
          siteCount: STORY_SITES.length,
          supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
          defaultLocale: 'inherit',
          browserProfiles: [
            {
              id: 'plugin:kawaikara.builtin-sites:google',
              name: 'Google',
              description: 'Shares Google sign-in between YouTube integrations.',
              persistent: true,
              source: 'plugin',
              pluginId: 'kawaikara.builtin-sites',
              pluginName: 'Kawaikara Built-in Sites',
            },
          ],
        },
      ],
    },
    sites: {
      list: async () =>
        STORY_SITES.map((site) => ({
          ...site,
          isCurrent: site.id === currentSiteId,
        })),
      open: async (id) => {
        currentSiteId = id;
        emitHidden();
      },
      openAddress: async (value) =>
        /(?:youtube\.com|kawaikara:)/i.test(value)
          ? { status: 'opened', siteId: 'kawaikara.youtube' }
          : { status: 'unsupported' },
    },
    videoLibrary,
    overlay: {
      close: async () => emitHidden(),
      setView: async (view) => {
        overlayVisible = true;
        queueMicrotask(() => {
          if (view === 'menu') emitMenu();
          else preferenceHandlers.forEach((handler) => handler());
        });
      },
      onShowMenu: (handler) => {
        menuHandlers.add(handler);
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key !== 'Tab') return;
          event.preventDefault();
          if (overlayVisible) {
            requestCloseHandlers.forEach((closeHandler) => closeHandler());
          } else {
            emitMenu();
          }
        };
        document.addEventListener('keydown', handleKeyDown);
        queueMicrotask(emitMenu);
        return () => {
          menuHandlers.delete(handler);
          document.removeEventListener('keydown', handleKeyDown);
        };
      },
      onShowPreferences: (handler) => {
        preferenceHandlers.add(handler);
        return () => preferenceHandlers.delete(handler);
      },
      onRequestClose: (handler) => {
        requestCloseHandlers.add(handler);
        return () => requestCloseHandlers.delete(handler);
      },
      onHidden: (handler) => {
        hiddenHandlers.add(handler);
        return () => hiddenHandlers.delete(handler);
      },
    },
    media: {
      togglePictureInPicture: async () => ({
        mode: 'video',
        status: 'entered',
      }),
      toggleGamePictureInPicture: async () => ({
        mode: 'window',
        status: 'entered',
      }),
      onPictureInPictureChanged: () => () => undefined,
    },
    preferences: {
      get: async () => ({ ...preferences }),
      update: async (patch) => {
        preferences = { ...preferences, ...patch };
        return { ...preferences };
      },
    },
  };

  Object.defineProperty(window, 'kawaikara', {
    configurable: true,
    value: api,
  });
  const videoApi: KawaikaraVideoApi = {
    application: {
      getMessages: async (locale) =>
        getRendererMessages(locale ?? preferences.appLocale, 'en-US'),
      isFullScreen: async () => false,
      exitFullScreen: async () => undefined,
      togglePictureInPicture: async () => ({
        status: 'exited',
        mode: 'window',
      }),
      recoverPlaybackRenderer: async () => false,
      onFullScreenChanged: () => () => undefined,
      onPictureInPictureChanged: () => () => undefined,
      onVisibilityChanged: () => () => undefined,
    },
    source: {
      selectLocalFile: async () => null,
      getPlaybackCapabilities: async () => ({
        platform: 'darwin',
        arch: 'arm64',
        nativeBackendAvailable: false,
        hardwareAccelerationDisabled: false,
      }),
      getOpenRequest: async () => null,
      activateLocalFile: async (targetPath) => ({
        kind: 'local',
        displayName: targetPath.split(/[\\/]/).pop() ?? targetPath,
        path: targetPath,
        directory: targetPath.replace(/[\\/][^\\/]+$/, ''),
        url: `file://${targetPath.replace(/\\/g, '/')}`,
      }),
      onOpenRequest: () => () => undefined,
    },
    downloads: {
      getStatus: async () => ({
        installed: false,
        automaticInstallSupported: true,
        platform: 'darwin',
      }),
      install: async () => ({
        canceled: false,
        installerStarted: false,
        opened: true,
        status: {
          installed: true,
          automaticInstallSupported: true,
          platform: 'darwin',
          version: '0.1.0',
          appPath: '/Users/kawaikara/Applications/YT Section Downloader.app',
          message: 'YT Downloader 0.1.0 설치가 완료되었습니다.',
        },
      }),
      open: async () => ({
        opened: true,
        status: {
          installed: true,
          automaticInstallSupported: true,
          platform: 'darwin',
          version: '0.1.0',
        },
      }),
      openReleasePage: async () => undefined,
    },
    videoLibrary,
    preferences: {
      get: async () => ({ ...preferences }),
      setVideoVolume: async (value) => {
        preferences = {
          ...preferences,
          videoVolume: Math.min(100, Math.max(0, Math.round(value))),
        };
        return preferences.videoVolume;
      },
    },
    presentation: {
      update: () => undefined,
    },
  };
  Object.defineProperty(window, 'kawaikaraVideo', {
    configurable: true,
    value: videoApi,
  });
  return api;
}
