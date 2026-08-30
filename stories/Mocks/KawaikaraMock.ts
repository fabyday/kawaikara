import type {
  ApplicationUpdatePanelState,
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

/** Defines the shared story messages constant. */
export const STORY_MESSAGES = getRendererMessages('system', 'en-US');

/** Performs the svg icon operation. */
const svgIcon = (label: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="${color}" />
      <text x="32" y="41" text-anchor="middle" font-family="system-ui" font-size="28" font-weight="700" fill="white">${label}</text>
    </svg>
  `)}`;

/** Defines the shared story sites constant. */
export const STORY_SITES: SiteMenuItem[] = [
  {
    /** The ID value. */
    id: 'kawaikara.netflix',
    /** The bundle ID value. */
    bundleId: 'kawaikara.builtin-sites',
    /** The title value. */
    title: 'Netflix',
    /** The address hosts value. */
    addressHosts: ['netflix.com'],
    /** The category value. */
    category: 'OTT',
    /** The icon value. */
    icon: svgIcon('N', '#e50914'),
    /** The panels value. */
    panels: [],
    /** The order value. */
    order: 10,
    /** The default shortcut value. */
    defaultShortcut: 'Control+Alt+1',
    /** The action shortcuts value. */
    actionShortcuts: [],
    /** The supported locales value. */
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    /** The default locale value. */
    defaultLocale: 'inherit',
    /** The DRM value. */
    drm: true,
    /** The picture in picture enabled value. */
    pictureInPictureEnabled: true,
    /** Whether the current option is enabled. */
    isCurrent: false,
  },
  {
    /** The ID value. */
    id: 'kawaikara.laftel',
    /** The bundle ID value. */
    bundleId: 'kawaikara.builtin-sites',
    /** The title value. */
    title: 'Laftel',
    /** The address hosts value. */
    addressHosts: ['laftel.net'],
    /** The category value. */
    category: 'OTT',
    /** The icon value. */
    icon: svgIcon('L', '#6d5dfc'),
    /** The panels value. */
    panels: [],
    /** The order value. */
    order: 20,
    /** The default shortcut value. */
    defaultShortcut: 'Control+Alt+2',
    /** The action shortcuts value. */
    actionShortcuts: [],
    /** The supported locales value. */
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    /** The default locale value. */
    defaultLocale: 'inherit',
    /** The DRM value. */
    drm: false,
    /** The picture in picture enabled value. */
    pictureInPictureEnabled: true,
    /** Whether the current option is enabled. */
    isCurrent: false,
  },
  {
    /** The ID value. */
    id: 'kawaikara.coupang-play',
    /** The bundle ID value. */
    bundleId: 'kawaikara.builtin-sites',
    /** The title value. */
    title: 'Coupang Play',
    /** The address hosts value. */
    addressHosts: ['coupangplay.com'],
    /** The category value. */
    category: 'OTT',
    /** The icon value. */
    icon: svgIcon('C', '#00a8ff'),
    /** The panels value. */
    panels: [],
    /** The order value. */
    order: 30,
    /** The default shortcut value. */
    defaultShortcut: 'Control+Alt+9',
    /** The action shortcuts value. */
    actionShortcuts: [],
    /** The supported locales value. */
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    /** The default locale value. */
    defaultLocale: 'inherit',
    /** The DRM value. */
    drm: true,
    /** The picture in picture enabled value. */
    pictureInPictureEnabled: true,
    /** Whether the current option is enabled. */
    isCurrent: false,
  },
  {
    /** The ID value. */
    id: 'kawaikara.video',
    /** The bundle ID value. */
    bundleId: 'kawaikara.builtin-sites',
    /** The title value. */
    title: 'Video',
    /** The address hosts value. */
    addressHosts: [],
    /** The category value. */
    category: 'Video',
    /** The panels value. */
    panels: [{
      /** The ID value. */
      id: 'provider:kawaikara.video:library',
      /** The title value. */
      title: 'Library',
      /** The order value. */
      order: 0,
      /** The content value. */
      content: {
        /** The kind value. */
        kind: 'internal',
        /** The view ID value. */
        viewId: 'video-library' },
    }],
    /** The order value. */
    order: 0,
    /** The default shortcut value. */
    defaultShortcut: 'Control+Alt+4',
    /** The action shortcuts value. */
    actionShortcuts: [],
    /** The supported locales value. */
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    /** The default locale value. */
    defaultLocale: 'inherit',
    /** The DRM value. */
    drm: false,
    /** The picture in picture enabled value. */
    pictureInPictureEnabled: true,
    /** Whether the current option is enabled. */
    isCurrent: false,
  },
  {
    /** The ID value. */
    id: 'kawaikara.youtube',
    /** The bundle ID value. */
    bundleId: 'kawaikara.builtin-sites',
    /** The title value. */
    title: 'YouTube',
    /** The address hosts value. */
    addressHosts: ['youtube.com'],
    /** The category value. */
    category: 'Video',
    /** The icon value. */
    icon: svgIcon('▶', '#ff0033'),
    /** The panels value. */
    panels: [],
    /** The order value. */
    order: 10,
    /** The default shortcut value. */
    defaultShortcut: 'Control+Alt+5',
    /** The action shortcuts value. */
    actionShortcuts: [],
    /** The supported locales value. */
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    /** The default locale value. */
    defaultLocale: 'inherit',
    /** The default browser profile ID value. */
    defaultBrowserProfileId: 'plugin:kawaikara.builtin-sites:google-v2',
    /** The DRM value. */
    drm: false,
    /** The picture in picture enabled value. */
    pictureInPictureEnabled: true,
    /** Whether the current option is enabled. */
    isCurrent: true,
  },
  {
    /** The ID value. */
    id: 'kawaikara.spotify',
    /** The bundle ID value. */
    bundleId: 'kawaikara.builtin-sites',
    /** The title value. */
    title: 'Spotify',
    /** The address hosts value. */
    addressHosts: ['spotify.com'],
    /** The category value. */
    category: 'Music',
    /** The icon value. */
    icon: svgIcon('S', '#1db954'),
    /** The panels value. */
    panels: [],
    /** The order value. */
    order: 10,
    /** The default shortcut value. */
    defaultShortcut: 'Control+Alt+S',
    /** The action shortcuts value. */
    actionShortcuts: [],
    /** The supported locales value. */
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    /** The default locale value. */
    defaultLocale: 'inherit',
    /** The DRM value. */
    drm: false,
    /** The picture in picture enabled value. */
    pictureInPictureEnabled: false,
    /** Whether the current option is enabled. */
    isCurrent: false,
  },
];

/** Defines the shared default preferences constant. */
const DEFAULT_PREFERENCES: PreferenceState = {
  /** The always on top value. */
  alwaysOnTop: false,
  /** The graphics mode value. */
  graphicsMode: 'capture',
  /** The open menu on startup value. */
  openMenuOnStartup: true,
  /** The close menu on escape value. */
  closeMenuOnEscape: true,
  /** The close menu on outside click value. */
  closeMenuOnOutsideClick: true,
  /** The automatic updates value. */
  automaticUpdates: false,
  /** The update channel value. */
  updateChannel: 'staging',
  /** The default site ID value. */
  defaultSiteId: 'kawaikara.youtube',
  /** The dev tools mode value. */
  devToolsMode: 'detach',
  /** The open dev tools automatically value. */
  openDevToolsAutomatically: false,
  /** The development mode value. */
  developmentMode: true,
  /** The development inspector enabled value. */
  developmentInspectorEnabled: true,
  /** The development inspector port value. */
  developmentInspectorPort: 9230,
  /** The app locale value. */
  appLocale: 'system',
  /** The app theme value. */
  appTheme: 'dark',
  /** The picture in picture placement value. */
  pictureInPicturePlacement: DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  /** The picture in picture portrait size value. */
  pictureInPicturePortraitSize: DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  /** The picture in picture size value. */
  pictureInPictureSize: DEFAULT_PICTURE_IN_PICTURE_SIZE,
  /** The plugin locales value. */
  pluginLocales: {},
  /** The site locales value. */
  siteLocales: {},
  /** The browser profiles value. */
  browserProfiles: [],
  /** The site browser profiles value. */
  siteBrowserProfiles: {},
  /** The provider settings value. */
  providerSettings: {
    /** The Kawaikara YouTube value. */
    'kawaikara.youtube': {
      /** The short form video auto advance value. */
      'short-form-video.auto-advance': true,
      /** The short form video banned publishers value. */
      'short-form-video.banned-publishers': [
        {
          /** The ID value. */
          id: 'UC-demo-publisher-1',
          /** The label value. */
          label: 'Demo Publisher',
          /** The description value. */
          description: '@demo-publisher' },
        {
          /** The ID value. */
          id: 'UC-demo-publisher-2',
          /** The label value. */
          label: 'Animation Archive',
          /** The description value. */
          description: '@animation-archive' },
        {
          /** The ID value. */
          id: 'UC-demo-publisher-3',
          /** The label value. */
          label: 'Night Radio',
          /** The description value. */
          description: '@night-radio' },
        {
          /** The ID value. */
          id: 'UC-demo-publisher-4',
          /** The label value. */
          label: 'Cooking Shorts',
          /** The description value. */
          description: '@cooking-shorts' },
        {
          /** The ID value. */
          id: 'UC-demo-publisher-5',
          /** The label value. */
          label: 'Indie Studio',
          /** The description value. */
          description: '@indie-studio' },
        {
          /** The ID value. */
          id: 'UC-demo-publisher-6',
          /** The label value. */
          label: 'Travel Log',
          /** The description value. */
          description: '@travel-log' },
      ],
    },
  },
  /** The menu category order value. */
  menuCategoryOrder: [],
  /** The menu site order value. */
  menuSiteOrder: [],
  /** The video seek seconds value. */
  videoSeekSeconds: 10,
  /** The video overlay hide seconds value. */
  videoOverlayHideSeconds: 1.8,
  /** The video controls layout value. */
  videoControlsLayout: 'inline',
  /** The video volume value. */
  videoVolume: 100,
  /** The log level value. */
  logLevel: 'info',
  /** The shortcuts value. */
  shortcuts: {},
};

/** Describes the Kawaikara mock options contract. */
export interface KawaikaraMockOptions {
  /** The build channel value. */
  readonly buildChannel?: ReleaseChannel;
  /** The current site ID value. */
  readonly currentSiteId?: string;
  /** Whether the update available option is enabled. */
  readonly updateAvailable?: boolean;
}

/** Installs the Kawaikara mock. */
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
  const updateHandlers = new Set<(state: ApplicationUpdatePanelState) => void>();
  const updateStateHandlers = new Set<
    (state: ApplicationUpdatePanelState) => void
  >();
  const developmentStateHandlers = new Set<
    (state: ReturnType<KawaikaraRendererApi['development']['getState']> extends
      Promise<infer T> ? T : never) => void
  >();
  let updateState: ApplicationUpdatePanelState | undefined;

  /** Performs the emit hidden operation. */
  const emitHidden = () => {
    overlayVisible = false;
    hiddenHandlers.forEach((handler) => handler());
  };

  /** Performs the emit menu operation. */
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
        updateChannelLocked: true,
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
      checkForUpdates: async () => {
        updateState = {
          phase: options.updateAvailable ? 'available' : 'up-to-date',
          origin: 'manual',
          channel: buildChannel,
          currentVersion: appVersion,
          latestVersion: options.updateAvailable ? nextVersion : appVersion,
          releaseNotes: options.updateAvailable
            ? 'Improved provider isolation.\nSmoother Video playback.'
            : undefined,
        };
        updateHandlers.forEach((handler) => handler(updateState!));
        updateStateHandlers.forEach((handler) => handler(updateState!));
        return {
          status: options.updateAvailable ? 'update-available' as const : 'up-to-date' as const,
          channel: buildChannel,
          currentVersion: appVersion,
          latestVersion: options.updateAvailable ? nextVersion : appVersion,
        };
      },
      getUpdateState: async () => updateState,
      downloadUpdate: async () => {
        if (!updateState) throw new Error('No update is available.');
        updateState = {
          ...updateState,
          phase: 'downloaded',
          progress: {
            percent: 100,
            bytesPerSecond: 0,
            transferred: 84_000_000,
            total: 84_000_000,
          },
        };
        updateStateHandlers.forEach((handler) => handler(updateState!));
        return updateState;
      },
      installUpdate: async () => undefined,
      copyText: async () => undefined,
      onUpdateStateChanged: (handler) => {
        updateStateHandlers.add(handler);
        return () => updateStateHandlers.delete(handler);
      },
      isFullScreen: async () => false,
      exitFullScreen: async () => undefined,
    },
    bundles: {
      runtime: async () => [
        {
          kind: 'bundle',
          id: 'kawaikara.builtin-sites',
          name: 'Kawaikara Built-in Sites',
          description: 'Official Providers bundled with Kawaikara.',
          version: '3.0.0-dev.0',
          providerCount: STORY_SITES.length,
          pluginCount: 0,
          supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
          defaultLocale: 'inherit',
          browserProfiles: [
            {
              id: 'plugin:kawaikara.builtin-sites:google-v2',
              name: 'Google',
              description: 'Shares Google sign-in between YouTube integrations.',
              persistent: true,
              source: 'plugin',
              pluginId: 'kawaikara.builtin-sites',
              pluginName: 'Kawaikara Built-in Sites',
            },
          ],
          providers: [
            {
              id: 'kawaikara.youtube',
              title: 'YouTube',
              settings: [
                {
                  id: 'shorts',
                  title: { 'en-US': 'Shorts', 'ko-KR': '쇼츠' },
                  settings: [
                    {
                      type: 'boolean',
                      key: 'short-form-video.auto-advance',
                      title: 'Play the next Short automatically',
                      defaultValue: true,
                    },
                    {
                      type: 'item-list',
                      key: 'short-form-video.banned-publishers',
                      title: 'Banned publishers',
                      emptyText: 'No publishers are banned.',
                    },
                  ],
                },
              ],
              shortFormVideo: {
                previous: true,
                next: true,
                autoAdvance: {
                  settingKey: 'short-form-video.auto-advance',
                  defaultValue: true,
                },
                publisherBan: {
                  settingKey: 'short-form-video.banned-publishers',
                },
              },
            },
          ],
        },
      ],
      list: async () => [
        {
          id: 'kawaikara.builtin-sites',
          name: 'Kawaikara Built-in Sites',
          description: 'Official Providers bundled with Kawaikara.',
          version: '3.0.0-dev.0',
          updatable: true,
          kind: 'bundle',
          source: 'built-in',
          status: 'active',
          providerCount: STORY_SITES.length,
          pluginCount: 1,
          permissions: ['navigation', 'script-injection'],
        },
      ],
      install: async () => ({ status: 'cancelled' }),
      update: async () => ({ status: 'cancelled' }),
      remove: async () => ({ status: 'cancelled' }),
    },
    development: {
      getState: async () => ({
        enabled: preferences.developmentMode,
        debugger: {
          enabled: preferences.developmentInspectorEnabled,
          active: preferences.developmentInspectorEnabled,
          address: '127.0.0.1',
          port: preferences.developmentInspectorPort,
          url: preferences.developmentInspectorEnabled
            ? 'ws://127.0.0.1:9230/storybook'
            : undefined,
        },
        projects: [{
          id: 'storybook-bundle-project',
          name: 'kawaikara-bundle-template',
          projectPath: '/Users/developer/KawaiBundleTemplate',
          outputDirectory: '.kawaikara/development',
          bundleId: 'example.kawaikara-bundle',
          hotReload: true,
          status: 'active',
          revision: '1787685295820-41ba7c1d',
          lastBuiltAt: new Date().toISOString(),
        }],
      }),
      attach: async () => ({ status: 'cancelled' }),
      rebuild: async () => api.development.getState(),
      setHotReload: async () => api.development.getState(),
      detach: async () => api.development.getState(),
      getVsCodeConfiguration: async () => '{}\n',
      onStateChanged: (handler) => {
        developmentStateHandlers.add(handler);
        return () => developmentStateHandlers.delete(handler);
      },
    },
    sites: {
      list: async () =>
        STORY_SITES.map((site) => ({
          ...site,
          isCurrent: site.id === currentSiteId,
        })),
      currentAddress: async () => 'https://www.youtube.com/',
      navigationState: async () => ({
        canGoBack: true,
        canGoForward: true,
      }),
      goBack: async () => true,
      goForward: async () => true,
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
          else if (view === 'preference') {
            preferenceHandlers.forEach((handler) => handler());
          } else if (updateState) {
            updateHandlers.forEach((handler) => handler(updateState!));
          }
        });
      },
      onShowMenu: (handler) => {
        menuHandlers.add(handler);
        /** Handles the key down. */
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
      onShowUpdate: (handler) => {
        updateHandlers.add(handler);
        return () => updateHandlers.delete(handler);
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
      previewTheme: async () => undefined,
      update: async (patch) => {
        preferences = { ...preferences, ...patch };
        return { ...preferences };
      },
    },
    data: {
      clearBrowserProfile: async () => ({ status: 'cleared' }),
      clearIsolatedSite: async () => ({ status: 'cleared' }),
      clearAllBrowserProfiles: async () => ({ status: 'cleared' }),
      clearApplicationCache: async () => ({ status: 'cancelled' }),
      resetApplication: async () => ({ status: 'cancelled' }),
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
      notifyPlaybackRendererReady: () => undefined,
      onFullScreenChanged: () => () => undefined,
      onPictureInPictureChanged: () => () => undefined,
      onPictureInPicturePointerChanged: () => () => undefined,
      onVisibilityChanged: () => () => undefined,
    },
    source: {
      selectLocalFile: async () => null,
      getPlaybackCapabilities: async () => ({
        platform: 'darwin',
        arch: 'arm64',
        nativeBackendAvailable: false,
        electronGpuAccelerationEnabled: true,
        hardwareAccelerationDisabled: false,
        nativeRenderMode: 'shared-texture',
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
