import type {
  ExternalDownloaderInstallResult,
  ExternalDownloaderOpenResult,
  ExternalDownloaderStatus,
} from './Download';
import type { ReleaseChannel } from './BuildConfig';
import type {
  PictureInPicturePlacementPreference,
  PictureInPictureSizePreference,
} from './PictureInPicture';
import type { RendererMessages } from '../Main/Functional/RendererMessages';
import type {
  ProviderSettingCategoryContribution,
  ProviderLocalizedText,
  ProviderSettingValue as SiteProviderSettingValue,
  ShortFormVideoContribution,
} from '@kawaikara/site-api';
export type {
  AppMessages,
  RendererMessages,
  VideoBrowserMessages,
  VideoLibraryMessages,
  VideoMessages,
} from '../Main/Functional/RendererMessages';

/** Defines the IPC channel name type. */
type IpcChannelName = `kawaikara:${string}`;

/** Describes the IPC channel tree contract. */
export interface IpcChannelTree {
  /** Maps each supported key to its corresponding value. */
  readonly [key: string]: IpcChannelName | IpcChannelTree;
}

/** Performs the define IPC channels operation. */
function defineIpcChannels<const T extends IpcChannelTree>(channels: T): T {
  return channels;
}

/** Defines the shared IPC channels constant. */
export const IPC_CHANNELS = defineIpcChannels({
  /** The sites value. */
  sites: {
    /** The list value. */
    list: 'kawaikara:sites:list',
    /** The current address value. */
    currentAddress: 'kawaikara:sites:current-address',
    /** The navigation state value. */
    navigationState: 'kawaikara:sites:navigation-state',
    /** The go back value. */
    goBack: 'kawaikara:sites:go-back',
    /** The go forward value. */
    goForward: 'kawaikara:sites:go-forward',
    /** The open value. */
    open: 'kawaikara:sites:open',
    /** The open address value. */
    openAddress: 'kawaikara:sites:open-address',
  },
  /** The application value. */
  application: {
    /** The info value. */
    info: 'kawaikara:application:info',
    /** The list displays value. */
    listDisplays: 'kawaikara:application:list-displays',
    /** The open link value. */
    openLink: 'kawaikara:application:open-link',
    /** The open dev tools value. */
    openDevTools: 'kawaikara:application:open-dev-tools',
    /** The open log directory value. */
    openLogDirectory: 'kawaikara:application:open-log-directory',
    /** The developer you tube status value. */
    developerYouTubeStatus: 'kawaikara:application:developer-youtube-status',
    /** The check for updates value. */
    checkForUpdates: 'kawaikara:application:check-for-updates',
    /** The get update state value. */
    getUpdateState: 'kawaikara:application:get-update-state',
    /** The download update value. */
    downloadUpdate: 'kawaikara:application:download-update',
    /** The install update value. */
    installUpdate: 'kawaikara:application:install-update',
    /** The update state changed value. */
    updateStateChanged: 'kawaikara:application:update-state-changed',
    /** The messages value. */
    messages: 'kawaikara:application:messages',
    /** The copy text value. */
    copyText: 'kawaikara:application:copy-text',
    /** Whether the full screen option is enabled. */
    isFullScreen: 'kawaikara:application:is-full-screen',
    /** The exit full screen value. */
    exitFullScreen: 'kawaikara:application:exit-full-screen',
    /** The full screen changed value. */
    fullScreenChanged: 'kawaikara:application:full-screen-changed',
  },
  /** The bundles value. */
  bundles: {
    /** The runtime value. */
    runtime: 'kawaikara:bundles:runtime',
    /** The list value. */
    list: 'kawaikara:bundles:list',
    /** The install value. */
    install: 'kawaikara:bundles:install',
    /** The update value. */
    update: 'kawaikara:bundles:update',
    /** The remove value. */
    remove: 'kawaikara:bundles:remove',
  },
  /** The development value. */
  development: {
    /** The state value. */
    state: 'kawaikara:development:state',
    /** The attach value. */
    attach: 'kawaikara:development:attach',
    /** The rebuild value. */
    rebuild: 'kawaikara:development:rebuild',
    /** The set hot reload value. */
    setHotReload: 'kawaikara:development:set-hot-reload',
    /** The detach value. */
    detach: 'kawaikara:development:detach',
    /** The vscode configuration value. */
    vscodeConfiguration: 'kawaikara:development:vscode-configuration',
    /** The state changed value. */
    stateChanged: 'kawaikara:development:state-changed',
  },
  /** The overlay value. */
  overlay: {
    /** The close value. */
    close: 'kawaikara:overlay:close',
    /** The set view value. */
    setView: 'kawaikara:overlay:set-view',
    /** The editing changed value. */
    editingChanged: 'kawaikara:overlay:editing-changed',
    /** The show menu value. */
    showMenu: 'kawaikara:overlay:show-menu',
    /** The show preferences value. */
    showPreferences: 'kawaikara:overlay:show-preferences',
    /** The show update value. */
    showUpdate: 'kawaikara:overlay:show-update',
    /** The request close value. */
    requestClose: 'kawaikara:overlay:request-close',
    /** The hidden value. */
    hidden: 'kawaikara:overlay:hidden',
  },
  /** The media value. */
  media: {
    /** The toggle picture in picture value. */
    togglePictureInPicture: 'kawaikara:media:toggle-picture-in-picture',
    /** The toggle game picture in picture value. */
    toggleGamePictureInPicture: 'kawaikara:media:toggle-game-picture-in-picture',
    /** The picture in picture changed value. */
    pictureInPictureChanged: 'kawaikara:media:picture-in-picture-changed',
  },
  /** The video value. */
  video: {
    /** The open dropped files value. */
    openDroppedFiles: 'kawaikara:video:open-dropped-files',
    /** The select local file value. */
    selectLocalFile: 'kawaikara:video:select-local-file',
    /** The get playback capabilities value. */
    getPlaybackCapabilities: 'kawaikara:video:get-playback-capabilities',
    /** The get open request value. */
    getOpenRequest: 'kawaikara:video:get-open-request',
    /** The activate local file value. */
    activateLocalFile: 'kawaikara:video:activate-local-file',
    /** The open request changed value. */
    openRequestChanged: 'kawaikara:video:open-request-changed',
    /** The library snapshot value. */
    librarySnapshot: 'kawaikara:video:library-snapshot',
    /** The list directory value. */
    listDirectory: 'kawaikara:video:list-directory',
    /** The open path value. */
    openPath: 'kawaikara:video:open-path',
    /** The search directory value. */
    searchDirectory: 'kawaikara:video:search-directory',
    /** The pin folder value. */
    pinFolder: 'kawaikara:video:pin-folder',
    /** The remove folder value. */
    removeFolder: 'kawaikara:video:remove-folder',
    /** The open library item value. */
    openLibraryItem: 'kawaikara:video:open-library-item',
    /** The thumbnail value. */
    thumbnail: 'kawaikara:video:thumbnail',
    /** The presentation changed value. */
    presentationChanged: 'kawaikara:video:presentation-changed',
    /** The picture in picture changed value. */
    pictureInPictureChanged: 'kawaikara:video:picture-in-picture-changed',
    /** The picture in picture pointer presence changed value. */
    pictureInPicturePointerChanged:
      'kawaikara:video:picture-in-picture-pointer-changed',
    /** The visibility changed value. */
    visibilityChanged: 'kawaikara:video:visibility-changed',
    /** The recover playback renderer value. */
    recoverPlaybackRenderer: 'kawaikara:video:recover-playback-renderer',
    /** The playback renderer ready value. */
    playbackRendererReady: 'kawaikara:video:playback-renderer-ready',
    /** The set volume preference value. */
    setVolumePreference: 'kawaikara:video:set-volume-preference',
  },
  /** The downloads value. */
  downloads: {
    /** The open you tube value. */
    openYouTube: 'kawaikara:downloads:open-youtube',
    /** The status value. */
    status: 'kawaikara:downloads:status',
    /** The install value. */
    install: 'kawaikara:downloads:install',
    /** The open value. */
    open: 'kawaikara:downloads:open',
    /** The open release page value. */
    openReleasePage: 'kawaikara:downloads:open-release-page',
  },
  /** The preferences value. */
  preferences: {
    /** The get value. */
    get: 'kawaikara:preferences:get',
    /** The preview theme value. */
    previewTheme: 'kawaikara:preferences:preview-theme',
    /** The update value. */
    update: 'kawaikara:preferences:update',
  },
  /** The data value. */
  data: {
    /** The clear browser profile value. */
    clearBrowserProfile: 'kawaikara:data:clear-browser-profile',
    /** The clear isolated site value. */
    clearIsolatedSite: 'kawaikara:data:clear-isolated-site',
    /** The clear all browser profiles value. */
    clearAllBrowserProfiles: 'kawaikara:data:clear-all-browser-profiles',
    /** The clear application cache value. */
    clearApplicationCache: 'kawaikara:data:clear-application-cache',
    /** The reset application value. */
    resetApplication: 'kawaikara:data:reset-application',
  },
} as const);

/** Defines the leaf values type. */
type LeafValues<T> = T extends IpcChannelName
  ? T
  : T extends object
    ? { [K in keyof T]: LeafValues<T[K]> }[keyof T]
    : never;

/** Union of every registered IPC channel literal. */
export type IpcChannel = LeafValues<typeof IPC_CHANNELS>;

/** Namespace-shaped type when consumers need the complete channel tree. */
export type IpcChannels = typeof IPC_CHANNELS;

/** Defines the overlay view type. */
export type OverlayView = 'menu' | 'preference' | 'update';

/** Defines the picture in picture status type. */
export type PictureInPictureStatus =
  | 'entered'
  | 'exited'
  | 'no-video'
  | 'not-ready'
  | 'disabled'
  | 'unsupported'
  | 'failed';

/** Defines the picture in picture mode type. */
export type PictureInPictureMode = 'video' | 'window';

/** Describes the picture in picture result contract. */
export interface PictureInPictureResult {
  /** The mode value. */
  readonly mode?: PictureInPictureMode;
  /** The status value. */
  readonly status: PictureInPictureStatus;
}

/** Describes the site menu item contract. */
export interface SiteMenuItem {
  /** The ID value. */
  readonly id: string;
  /** The bundle ID value. */
  readonly bundleId: string;
  /** The title value. */
  readonly title: string;
  /** The address hosts value. */
  readonly addressHosts: readonly string[];
  /** The category value. */
  readonly category: string;
  /** The icon value. */
  readonly icon?: string;
  /** The panels value. */
  readonly panels: readonly PluginViewPanelInfo[];
  /** The order value. */
  readonly order: number;
  /** The default shortcut value. */
  readonly defaultShortcut: string;
  /** The action shortcuts value. */
  readonly actionShortcuts: readonly ProviderActionShortcutInfo[];
  /** The supported locales value. */
  readonly supportedLocales: readonly string[];
  /** The default locale value. */
  readonly defaultLocale: string;
  /** The default browser profile ID value. */
  readonly defaultBrowserProfileId?: string;
  /** Whether the DRM option is enabled. */
  readonly drm: boolean;
  /** Whether the picture in picture enabled option is enabled. */
  readonly pictureInPictureEnabled: boolean;
  /** Whether the current option is enabled. */
  readonly isCurrent: boolean;
}

/** Describes the plugin view panel info contract. */
export interface PluginViewPanelInfo {
  /** Runtime identity composed from owner id and its locally scoped panel id. */
  readonly id: string;
  /** The title value. */
  readonly title: ProviderLocalizedText;
  /** The order value. */
  readonly order: number;
  /** The content value. */
  readonly content:
    | {
      /** The kind value. */
      readonly kind: 'internal';
      /** The view ID value. */
      readonly viewId: string;
    }
    | {
      /** The kind value. */
      readonly kind: 'html';
      /** The HTML value. */
      readonly html: string;
    };
}

/** Describes the provider action shortcut info contract. */
export interface ProviderActionShortcutInfo {
  /** The ID value. */
  readonly id: string;
  /** The title value. */
  readonly title: ProviderLocalizedText;
  /** The description value. */
  readonly description?: ProviderLocalizedText;
  /** The default key value. */
  readonly defaultKey: string;
  /** The action value. */
  readonly action: string;
}

/** Describes the provider runtime info contract. */
export interface ProviderRuntimeInfo {
  /** The ID value. */
  readonly id: string;
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description?: string;
  /** The settings value. */
  readonly settings: readonly ProviderSettingCategoryContribution[];
  /** The short form video value. */
  readonly shortFormVideo?: ShortFormVideoContribution;
}

/** Defines the browser profile source type. */
export type BrowserProfileSource = 'user' | 'plugin';

/** Describes the browser profile info contract. */
export interface BrowserProfileInfo {
  /** Globally unique runtime id, such as plugin:<plugin-id>:<profile-id>. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The description value. */
  readonly description?: string;
  /** Whether the persistent option is enabled. */
  readonly persistent: boolean;
  /** The source value. */
  readonly source: BrowserProfileSource;
  /** The plugin ID value. */
  readonly pluginId?: string;
  /** The plugin name value. */
  readonly pluginName?: string;
}

/** Describes the user browser profile contract. */
export interface UserBrowserProfile {
  /** Stable user profile id. The visible name may be changed independently. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** Whether the persistent option is enabled. */
  readonly persistent: boolean;
}

/** Describes the bundle runtime info contract. */
export interface BundleRuntimeInfo {
  /** The kind value. */
  readonly kind: 'bundle';
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The description value. */
  readonly description?: string;
  /** The version value. */
  readonly version: string;
  /** The provider count value. */
  readonly providerCount: number;
  /** The plugin count value. */
  readonly pluginCount: number;
  /** The supported locales value. */
  readonly supportedLocales: readonly string[];
  /** The default locale value. */
  readonly defaultLocale: string;
  /** The browser profiles value. */
  readonly browserProfiles: readonly BrowserProfileInfo[];
  /** The providers value. */
  readonly providers: readonly ProviderRuntimeInfo[];
}

/** Defines the bundle status type. */
export type BundleStatus = 'active' | 'restart-required' | 'failed';
/** Defines the bundle source type. */
export type BundleSource = 'built-in' | 'user' | 'development';

/** Describes the bundle info contract. */
export interface BundleInfo {
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The description value. */
  readonly description?: string;
  /** The version value. */
  readonly version: string;
  /** Whether the Bundle top-level manifest provides an update source. */
  readonly updatable: boolean;
  /** @deprecated Use updatable. Resolver-based updates do not expose a URL. */
  readonly updateUrl?: string;
  /** The kind value. */
  readonly kind: 'bundle' | 'unknown';
  /** The source value. */
  readonly source: BundleSource;
  /** The status value. */
  readonly status: BundleStatus;
  /** The provider count value. */
  readonly providerCount: number;
  /** The plugin count value. */
  readonly pluginCount: number;
  /** The permissions value. */
  readonly permissions: readonly string[];
  /** The error value. */
  readonly error?: string;
}

/** Defines the bundle install result type. */
export type BundleInstallResult =
  | {
    /** The status value. */
    readonly status: 'cancelled';
  }
  | {
    /** The status value. */
    readonly status: 'installed';
    /** The bundle value. */
    readonly bundle: BundleInfo;
  };

/** Defines the bundle update result type. */
export type BundleUpdateResult =
  | {
    /** The status value. */
    readonly status: 'cancelled';
  }
  | {
    /** The status value. */
    readonly status: 'updated';
    /** The bundle value. */
    readonly bundle: BundleInfo;
  };

/** Defines the bundle remove result type. */
export type BundleRemoveResult =
  | {
    /** The status value. */
    readonly status: 'cancelled';
  }
  | {
    /** The status value. */
    readonly status: 'removed';
    /** The bundle ID value. */
    readonly bundleId: string;
  };

/** Defines the development bundle status type. */
export type DevelopmentBundleStatus =
  | 'stopped'
  | 'watching'
  | 'building'
  | 'reloading'
  | 'active'
  | 'failed';

/** Describes the development bundle project info contract. */
export interface DevelopmentBundleProjectInfo {
  /** The ID value. */
  readonly id: string;
  /** The name value. */
  readonly name: string;
  /** The project path value. */
  readonly projectPath: string;
  /** The output directory value. */
  readonly outputDirectory: string;
  /** The bundle ID value. */
  readonly bundleId?: string;
  /** Whether the hot reload option is enabled. */
  readonly hotReload: boolean;
  /** The status value. */
  readonly status: DevelopmentBundleStatus;
  /** The revision value. */
  readonly revision?: string;
  /** The last built at value. */
  readonly lastBuiltAt?: string;
  /** The error value. */
  readonly error?: string;
}

/** Describes the development debugger info contract. */
export interface DevelopmentDebuggerInfo {
  /** Whether the enabled option is enabled. */
  readonly enabled: boolean;
  /** Whether the active option is enabled. */
  readonly active: boolean;
  /** The address value. */
  readonly address: string;
  /** The port value. */
  readonly port: number;
  /** The URL value. */
  readonly url?: string;
  /** The error value. */
  readonly error?: string;
}

/** Describes the development state contract. */
export interface DevelopmentState {
  /** Whether the enabled option is enabled. */
  readonly enabled: boolean;
  /** The debugger value. */
  readonly debugger: DevelopmentDebuggerInfo;
  /** The projects value. */
  readonly projects: readonly DevelopmentBundleProjectInfo[];
}

/** Defines the development bundle attach result type. */
export type DevelopmentBundleAttachResult =
  | {
    /** The status value. */
    readonly status: 'cancelled';
  }
  | {
      /** The status value. */
      readonly status: 'attached';
      /** The project value. */
      readonly project: DevelopmentBundleProjectInfo;
    };

/** Defines the application data action result type. */
export type ApplicationDataActionResult =
  | {
    /** The status value. */
    readonly status: 'cancelled';
  }
  | {
    /** The status value. */
    readonly status: 'cleared';
  }
  | {
    /** The status value. */
    readonly status: 'restarting';
  };

/** Describes the application info contract. */
export interface ApplicationInfo {
  /** The name value. */
  readonly name: string;
  /** The version value. */
  readonly version: string;
  /** The site API version value. */
  readonly siteApiVersion: number;
  /** The Electron version value. */
  readonly electronVersion: string;
  /** The chrome version value. */
  readonly chromeVersion: string;
  /** The platform value. */
  readonly platform: string;
  /** The arch value. */
  readonly arch: string;
  /** The build channel value. */
  readonly buildChannel: ReleaseChannel;
  /** Whether the update channel locked option is enabled. */
  readonly updateChannelLocked: boolean;
}

/** Describes the display info contract. */
export interface DisplayInfo {
  /** The ID value. */
  readonly id: string;
  /** The label value. */
  readonly label: string;
  /** The width value. */
  readonly width: number;
  /** The height value. */
  readonly height: number;
  /** The scale factor value. */
  readonly scaleFactor: number;
  /** Whether the primary option is enabled. */
  readonly primary: boolean;
  /** Whether the current option is enabled. */
  readonly current: boolean;
}

/** Defines the application link ID type. */
export type ApplicationLinkId =
  | 'website'
  | 'github'
  | 'discord'
  | 'developerYouTube';

/** Describes the developer you tube status contract. */
export interface DeveloperYouTubeStatus {
  /** Whether the live option is enabled. */
  readonly isLive: boolean;
  /** The checked at value. */
  readonly checkedAt: string;
  /** The error value. */
  readonly error?: string;
}

/** Defines the update check status type. */
export type UpdateCheckStatus =
  | 'up-to-date'
  | 'update-available'
  | 'unsupported'
  | 'error';

/** Describes the application update check result contract. */
export interface ApplicationUpdateCheckResult {
  /** The status value. */
  readonly status: UpdateCheckStatus;
  /** The channel value. */
  readonly channel: ReleaseChannel;
  /** The current version value. */
  readonly currentVersion: string;
  /** The latest version value. */
  readonly latestVersion?: string;
  /** The error value. */
  readonly error?: string;
}

/** Defines the application update phase type. */
export type ApplicationUpdatePhase =
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'unsupported'
  | 'error';

/** Describes the application update progress contract. */
export interface ApplicationUpdateProgress {
  /** The percent value. */
  readonly percent: number;
  /** The bytes per second value. */
  readonly bytesPerSecond: number;
  /** The transferred value. */
  readonly transferred: number;
  /** The total value. */
  readonly total: number;
}

/** Describes the application update panel state contract. */
export interface ApplicationUpdatePanelState {
  /** The phase value. */
  readonly phase: ApplicationUpdatePhase;
  /** The origin value. */
  readonly origin: 'manual' | 'automatic';
  /** The channel value. */
  readonly channel: ReleaseChannel;
  /** The current version value. */
  readonly currentVersion: string;
  /** The latest version value. */
  readonly latestVersion?: string;
  /** The release notes value. */
  readonly releaseNotes?: string;
  /** The progress value. */
  readonly progress?: ApplicationUpdateProgress;
  /** The error value. */
  readonly error?: string;
}

/** Defines the app locale type. */
export type AppLocale = 'system' | 'ko-KR' | 'en-US' | 'ja-JP';
/** Defines the app theme type. */
export type AppTheme = 'dark' | 'light';
/** Defines the graphics mode type. */
export type GraphicsMode = 'native' | 'capture' | 'software';
/** Defines the dev tools mode type. */
export type DevToolsMode = 'left' | 'right' | 'bottom' | 'undocked' | 'detach';
/** Defines the video controls layout type. */
export type VideoControlsLayout = 'inline' | 'overlay';
/** Defines the log level preference type. */
export type LogLevelPreference =
  | 'error'
  | 'warn'
  | 'info'
  | 'verbose'
  | 'debug'
  | 'none';
/** Kept for preference-file compatibility. The global app locale is authoritative. */
export type ScopedLocale = 'inherit' | AppLocale | (string & {});
/** Defines the provider setting value type. */
export type ProviderSettingValue = SiteProviderSettingValue;
/** Defines the provider setting record type. */
export type ProviderSettingRecord = Readonly<
  Record<string, ProviderSettingValue>
>;

/** Describes the preference state contract. */
export interface PreferenceState {
  /** Whether the always on top option is enabled. */
  readonly alwaysOnTop: boolean;
  /** Selects native GPU, capture-compatible GPU, or process-wide software rendering. */
  readonly graphicsMode: GraphicsMode;
  /** Whether the open menu on startup option is enabled. */
  readonly openMenuOnStartup: boolean;
  /** Whether the close menu on escape option is enabled. */
  readonly closeMenuOnEscape: boolean;
  /** Whether the close menu on outside click option is enabled. */
  readonly closeMenuOnOutsideClick: boolean;
  /** Whether the automatic updates option is enabled. */
  readonly automaticUpdates: boolean;
  /** The update channel value. */
  readonly updateChannel: ReleaseChannel;
  /** The default site ID value. */
  readonly defaultSiteId: string;
  /** The dev tools mode value. */
  readonly devToolsMode: DevToolsMode;
  /** Opens site DevTools at startup and reconnects it when the active site changes. */
  readonly openDevToolsAutomatically: boolean;
  /** Enables trusted local Bundle projects and the in-app development host. */
  readonly developmentMode: boolean;
  /** Opens the Main-process Node Inspector while development mode is enabled. */
  readonly developmentInspectorEnabled: boolean;
  /** Loopback-only Inspector port used by VS Code and compatible debuggers. */
  readonly developmentInspectorPort: number;
  /** The app locale value. */
  readonly appLocale: AppLocale;
  /** The app theme value. */
  readonly appTheme: AppTheme;
  /** The picture in picture placement value. */
  readonly pictureInPicturePlacement: PictureInPicturePlacementPreference;
  /** The picture in picture portrait size value. */
  readonly pictureInPicturePortraitSize: PictureInPictureSizePreference;
  /** The picture in picture size value. */
  readonly pictureInPictureSize: PictureInPictureSizePreference;
  /** @deprecated Locale overrides are cleared when global preferences are saved. */
  readonly pluginLocales: Readonly<Record<string, ScopedLocale>>;
  /** @deprecated Locale overrides are cleared when global preferences are saved. */
  readonly siteLocales: Readonly<Record<string, ScopedLocale>>;
  /** The browser profiles value. */
  readonly browserProfiles: readonly UserBrowserProfile[];
  /** Values are "isolated", user:<id>, or plugin:<plugin-id>:<profile-id>. */
  readonly siteBrowserProfiles: Readonly<Record<string, string>>;
  /** App-persisted values, namespaced by Provider id for Bundle extensibility. */
  readonly providerSettings: Readonly<Record<string, ProviderSettingRecord>>;
  /** Category ids in the order selected by the user. Unknown ids are ignored. */
  readonly menuCategoryOrder: readonly string[];
  /** Site ids in the order selected by the user, applied within each category. */
  readonly menuSiteOrder: readonly string[];
  /** Base distance used by the Video view's backward/forward seek shortcuts. */
  readonly videoSeekSeconds: number;
  /** Delay before overlay Video controls disappear, expressed in seconds. */
  readonly videoOverlayHideSeconds: number;
  /** Inline controls reserve space below video; overlay controls float and auto-hide. */
  readonly videoControlsLayout: VideoControlsLayout;
  /** Last volume selected in the Video view, from 0 through 100. */
  readonly videoVolume: number;
  /** The log level value. */
  readonly logLevel: LogLevelPreference;
  /** The shortcuts value. */
  readonly shortcuts: Readonly<Record<string, string>>;
}

/** Defines the preference patch type. */
export type PreferencePatch = Partial<PreferenceState>;

/** Describes the preference update options contract. */
export interface PreferenceUpdateOptions {
  /** Required when the patch changes the startup-only Electron graphics mode. */
  readonly restartForGraphicsChange?: boolean;
}

/** Defines the site address open result type. */
export type SiteAddressOpenResult =
  | {
    /** The status value. */
    readonly status: 'opened';
    /** The site ID value. */
    readonly siteId: string;
  }
  | {
    /** The status value. */
    readonly status: 'unsupported';
  };

/** Describes the video presentation state contract. */
export interface VideoPresentationState {
  /** Whether the ready option is enabled. */
  readonly ready: boolean;
  /** The width value. */
  readonly width: number;
  /** The height value. */
  readonly height: number;
}

/** Defines the video open request type. */
export type VideoOpenRequest =
  | {
      /** The kind value. */
      readonly kind: 'local';
      /** The display name value. */
      readonly displayName: string;
      /** The path value. */
      readonly path: string;
      /** The directory value. */
      readonly directory: string;
      /** The URL value. */
      readonly url: string;
    }
  | {
      /** The kind value. */
      readonly kind: 'folder';
      /** The display name value. */
      readonly displayName: string;
      /** The path value. */
      readonly path: string;
    }
  | {
      /** The kind value. */
      readonly kind: 'youtube';
      /** The URL value. */
      readonly url: string;
    };

/** Describes the video library location contract. */
export interface VideoLibraryLocation {
  /** The kind value. */
  readonly kind: 'drive' | 'system' | 'pinned';
  /** The name value. */
  readonly name: string;
  /** The path value. */
  readonly path: string;
}

/** Describes the video library folder contract. */
export interface VideoLibraryFolder {
  /** The name value. */
  readonly name: string;
  /** The path value. */
  readonly path: string;
  /** Whether the pinned option is enabled. */
  readonly pinned: boolean;
  /** The last opened at value. */
  readonly lastOpenedAt: string;
}

/** Describes the video library video contract. */
export interface VideoLibraryVideo {
  /** The name value. */
  readonly name: string;
  /** The path value. */
  readonly path: string;
  /** The directory value. */
  readonly directory: string;
  /** The last opened at value. */
  readonly lastOpenedAt: string;
}

/** Describes the video library snapshot contract. */
export interface VideoLibrarySnapshot {
  /** The last directory value. */
  readonly lastDirectory?: string;
  /** The locations value. */
  readonly locations: readonly VideoLibraryLocation[];
  /** The favorite folders value. */
  readonly favoriteFolders: readonly VideoLibraryFolder[];
  /** The recent folders value. */
  readonly recentFolders: readonly VideoLibraryFolder[];
  /** The recent videos value. */
  readonly recentVideos: readonly VideoLibraryVideo[];
}

/** Describes the video directory entry contract. */
export interface VideoDirectoryEntry {
  /** The kind value. */
  readonly kind: 'directory' | 'video';
  /** The name value. */
  readonly name: string;
  /** The path value. */
  readonly path: string;
  /** The size value. */
  readonly size?: number;
  /** The modified at value. */
  readonly modifiedAt?: string;
}

/** Describes the video directory listing contract. */
export interface VideoDirectoryListing {
  /** The directory value. */
  readonly directory: string;
  /** The display name value. */
  readonly displayName: string;
  /** The parent value. */
  readonly parent?: string;
  /** The entries value. */
  readonly entries: readonly VideoDirectoryEntry[];
}

/** Defines the video path open result type. */
export type VideoPathOpenResult =
  | {
      /** The kind value. */
      readonly kind: 'directory';
      /** The listing value. */
      readonly listing: VideoDirectoryListing;
    }
  | {
      /** The kind value. */
      readonly kind: 'video';
      /** The directory value. */
      readonly directory: string;
      /** The request value. */
      readonly request: Extract<VideoOpenRequest, {
        /** The kind value. */
        readonly kind: 'local';
      }>;
    };

/** Describes the video library API contract. */
export interface VideoLibraryApi {
  /** Returns the snapshot. */
  getSnapshot(): Promise<VideoLibrarySnapshot>;
  /** Lists the directory. */
  listDirectory(path: string): Promise<VideoDirectoryListing>;
  /** Opens the path. */
  openPath(path: string): Promise<VideoPathOpenResult>;
  /** Performs the search directory operation. */
  searchDirectory(path: string, query: string): Promise<VideoDirectoryEntry[]>;
  /** Sets the folder pinned. */
  setFolderPinned(path: string, pinned: boolean): Promise<VideoLibrarySnapshot>;
  /** Removes the folder. */
  removeFolder(path: string): Promise<VideoLibrarySnapshot>;
  /** Opens the item. */
  openItem(path: string): Promise<void>;
  /** Returns the thumbnail. */
  getThumbnail(path: string): Promise<string | undefined>;
}

/** Describes the video playback capabilities contract. */
export interface VideoPlaybackCapabilities {
  /** The platform value. */
  readonly platform: NodeJS.Platform;
  /** The arch value. */
  readonly arch: string;
  /** Whether the native backend available option is enabled. */
  readonly nativeBackendAvailable: boolean;
  /** False when app.disableHardwareAcceleration() selected software presentation. */
  readonly electronGpuAccelerationEnabled: boolean;
  /** True only when MPV_HWDEC explicitly disables native hardware decoding. */
  readonly hardwareAccelerationDisabled: boolean;
  /** The libmpv presentation pipeline selected for this Video window. */
  readonly nativeRenderMode: 'shared-texture' | 'software';
}

/** Describes the active site's bounded navigation state. */
export interface SiteNavigationState {
  /** Whether the active site can move to an earlier in-site entry. */
  readonly canGoBack: boolean;
  /** Whether the active site can move to a later in-site entry. */
  readonly canGoForward: boolean;
}

/** Describes the Kawaikara renderer API contract. */
export interface KawaikaraRendererApi {
  /** The application value. */
  application: {
    /** Returns the info. */
    getInfo(): Promise<ApplicationInfo>;
    /** Returns the messages. */
    getMessages(locale?: AppLocale): Promise<RendererMessages>;
    /** Lists the displays. */
    listDisplays(): Promise<DisplayInfo[]>;
    /** Opens the link. */
    openLink(id: ApplicationLinkId): Promise<void>;
    /** Opens the dev tools. */
    openDevTools(mode: DevToolsMode): Promise<void>;
    /** Opens the log directory. */
    openLogDirectory(): Promise<void>;
    /** Returns the developer you tube status. */
    getDeveloperYouTubeStatus(): Promise<DeveloperYouTubeStatus>;
    /** Performs the check for updates operation. */
    checkForUpdates(): Promise<ApplicationUpdateCheckResult>;
    /** Returns the update state. */
    getUpdateState(): Promise<ApplicationUpdatePanelState | undefined>;
    /** Performs the download update operation. */
    downloadUpdate(): Promise<ApplicationUpdatePanelState>;
    /** Installs the update. */
    installUpdate(): Promise<void>;
    /** Copies the text. */
    copyText(value: string): Promise<void>;
    /** Handles the update state changed. */
    onUpdateStateChanged(
      handler: (state: ApplicationUpdatePanelState) => void,
    ): () => void;
    /** Determines whether the full screen condition applies. */
    isFullScreen(): Promise<boolean>;
    /** Performs the exit full screen operation. */
    exitFullScreen(): Promise<void>;
  };
  /** The bundles value. */
  bundles: {
    /** Performs the runtime operation. */
    runtime(): Promise<BundleRuntimeInfo[]>;
    /** Lists the operation. */
    list(): Promise<BundleInfo[]>;
    /** Installs the operation. */
    install(locale: AppLocale): Promise<BundleInstallResult>;
    /** Updates the operation. */
    update(id: string, locale: AppLocale): Promise<BundleUpdateResult>;
    /** Removes the operation. */
    remove(id: string, locale: AppLocale): Promise<BundleRemoveResult>;
  };
  /** The development value. */
  development: {
    /** Returns the state. */
    getState(): Promise<DevelopmentState>;
    /** Attaches the operation. */
    attach(locale: AppLocale): Promise<DevelopmentBundleAttachResult>;
    /** Performs the rebuild operation. */
    rebuild(projectId: string): Promise<DevelopmentState>;
    /** Sets the hot reload. */
    setHotReload(projectId: string, enabled: boolean): Promise<DevelopmentState>;
    /** Detaches the operation. */
    detach(projectId: string): Promise<DevelopmentState>;
    /** Returns the vs code configuration. */
    getVsCodeConfiguration(): Promise<string>;
    /** Handles the state changed. */
    onStateChanged(handler: (state: DevelopmentState) => void): () => void;
  };
  /** The sites value. */
  sites: {
    /** Lists the operation. */
    list(): Promise<SiteMenuItem[]>;
    /** Performs the current address operation. */
    currentAddress(): Promise<string>;
    /** Returns the active site's bounded navigation state. */
    navigationState(): Promise<SiteNavigationState>;
    /** Performs the go back operation. */
    goBack(): Promise<boolean>;
    /** Performs the go forward operation. */
    goForward(): Promise<boolean>;
    /** Opens the operation. */
    open(id: string): Promise<void>;
    /** Opens the address. */
    openAddress(value: string): Promise<SiteAddressOpenResult>;
  };
  /** The video library value. */
  videoLibrary: VideoLibraryApi;
  /** The overlay value. */
  overlay: {
    /** Closes the operation. */
    close(): Promise<void>;
    /** Sets the view. */
    setView(view: OverlayView): Promise<void>;
    /** Handles the show menu. */
    onShowMenu(handler: () => void): () => void;
    /** Handles the show preferences. */
    onShowPreferences(handler: () => void): () => void;
    /** Handles the show update. */
    onShowUpdate(
      handler: (state: ApplicationUpdatePanelState) => void,
    ): () => void;
    /** Handles the request close. */
    onRequestClose(handler: () => void): () => void;
    /** Handles the hidden. */
    onHidden(handler: () => void): () => void;
  };
  /** The media value. */
  media: {
    /** Toggles the picture in picture. */
    togglePictureInPicture(): Promise<PictureInPictureResult>;
    /** Toggles the game picture in picture. */
    toggleGamePictureInPicture(): Promise<PictureInPictureResult>;
    /** Handles the picture in picture changed. */
    onPictureInPictureChanged(
      handler: (result: PictureInPictureResult) => void,
    ): () => void;
  };
  /** The preferences value. */
  preferences: {
    /** Returns the operation. */
    get(): Promise<PreferenceState>;
    /** Performs the preview theme operation. */
    previewTheme(theme: AppTheme): Promise<void>;
    /** Updates the operation. */
    update(
      patch: PreferencePatch,
      options?: PreferenceUpdateOptions,
    ): Promise<PreferenceState>;
  };
  /** The data value. */
  data: {
    /** Clears the browser profile. */
    clearBrowserProfile(
      profileId: string,
      locale: AppLocale,
    ): Promise<ApplicationDataActionResult>;
    /** Clears the isolated site. */
    clearIsolatedSite(
      siteId: string,
      locale: AppLocale,
    ): Promise<ApplicationDataActionResult>;
    /** Clears the all browser profiles. */
    clearAllBrowserProfiles(locale: AppLocale): Promise<ApplicationDataActionResult>;
    /** Clears the application cache. */
    clearApplicationCache(locale: AppLocale): Promise<ApplicationDataActionResult>;
    /** Resets the application. */
    resetApplication(locale: AppLocale): Promise<ApplicationDataActionResult>;
  };
}

/** Describes the Kawaikara video API contract. */
export interface KawaikaraVideoApi {
  /** The application value. */
  application: {
    /** Returns the messages. */
    getMessages(locale?: AppLocale): Promise<RendererMessages>;
    /** Determines whether the full screen condition applies. */
    isFullScreen(): Promise<boolean>;
    /** Performs the exit full screen operation. */
    exitFullScreen(): Promise<void>;
    /** Toggles the picture in picture. */
    togglePictureInPicture(): Promise<PictureInPictureResult>;
    /** Performs the recover playback renderer operation. */
    recoverPlaybackRenderer(): Promise<boolean>;
    /** Notifies Main that the Video playback renderer is ready. */
    notifyPlaybackRendererReady(): void;
    /** Handles the full screen changed. */
    onFullScreenChanged(handler: (fullScreen: boolean) => void): () => void;
    /** Handles the picture in picture changed. */
    onPictureInPictureChanged(handler: (active: boolean) => void): () => void;
    /** Handles pointer presence across the native Video PiP surface. */
    onPictureInPicturePointerChanged(
      handler: (inside: boolean) => void,
    ): () => void;
    /** Handles the visibility changed. */
    onVisibilityChanged(handler: (visible: boolean) => void): () => void;
  };
  /** The source value. */
  source: {
    /** Selects the local file. */
    selectLocalFile(): Promise<VideoOpenRequest | null>;
    /** Returns the playback capabilities. */
    getPlaybackCapabilities(): Promise<VideoPlaybackCapabilities>;
    /** Returns the open request. */
    getOpenRequest(): Promise<VideoOpenRequest | null>;
    /** Performs the activate local file operation. */
    activateLocalFile(
      path: string,
    ): Promise<Extract<VideoOpenRequest, {
      /** The kind value. */
      readonly kind: 'local';
    }>>;
    /** Handles the open request. */
    onOpenRequest(handler: (request: VideoOpenRequest) => void): () => void;
  };
  /** The downloads value. */
  downloads: {
    /** Reads the detected downloader installation and platform capabilities. */
    getStatus(): Promise<ExternalDownloaderStatus>;
    /** Starts the supported installation flow and optionally opens `url`. */
    install(url?: string): Promise<ExternalDownloaderInstallResult>;
    /** Opens a validated YouTube URL in the installed external downloader. */
    open(url: string): Promise<ExternalDownloaderOpenResult>;
    /** Opens the downloader release page for manual installation. */
    openReleasePage(): Promise<void>;
  };
  /** The preferences value. */
  preferences: {
    /** Returns the operation. */
    get(): Promise<PreferenceState>;
    /** Sets the video volume. */
    setVideoVolume(value: number): Promise<number>;
  };
  /** The presentation value. */
  presentation: {
    /** Updates the operation. */
    update(state: VideoPresentationState): void;
  };
  /** The video library value. */
  videoLibrary: VideoLibraryApi;
}
