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

type IpcChannelName = `kawaikara:${string}`;

export interface IpcChannelTree {
  readonly [key: string]: IpcChannelName | IpcChannelTree;
}

function defineIpcChannels<const T extends IpcChannelTree>(channels: T): T {
  return channels;
}

export const IPC_CHANNELS = defineIpcChannels({
  sites: {
    list: 'kawaikara:sites:list',
    currentAddress: 'kawaikara:sites:current-address',
    open: 'kawaikara:sites:open',
    openAddress: 'kawaikara:sites:open-address',
  },
  application: {
    info: 'kawaikara:application:info',
    listDisplays: 'kawaikara:application:list-displays',
    openLink: 'kawaikara:application:open-link',
    openDevTools: 'kawaikara:application:open-dev-tools',
    openLogDirectory: 'kawaikara:application:open-log-directory',
    developerYouTubeStatus: 'kawaikara:application:developer-youtube-status',
    checkForUpdates: 'kawaikara:application:check-for-updates',
    getUpdateState: 'kawaikara:application:get-update-state',
    downloadUpdate: 'kawaikara:application:download-update',
    installUpdate: 'kawaikara:application:install-update',
    updateStateChanged: 'kawaikara:application:update-state-changed',
    messages: 'kawaikara:application:messages',
    copyText: 'kawaikara:application:copy-text',
    isFullScreen: 'kawaikara:application:is-full-screen',
    exitFullScreen: 'kawaikara:application:exit-full-screen',
    fullScreenChanged: 'kawaikara:application:full-screen-changed',
  },
  bundles: {
    runtime: 'kawaikara:bundles:runtime',
    list: 'kawaikara:bundles:list',
    install: 'kawaikara:bundles:install',
    update: 'kawaikara:bundles:update',
    remove: 'kawaikara:bundles:remove',
  },
  overlay: {
    close: 'kawaikara:overlay:close',
    setView: 'kawaikara:overlay:set-view',
    editingChanged: 'kawaikara:overlay:editing-changed',
    showMenu: 'kawaikara:overlay:show-menu',
    showPreferences: 'kawaikara:overlay:show-preferences',
    showUpdate: 'kawaikara:overlay:show-update',
    requestClose: 'kawaikara:overlay:request-close',
    hidden: 'kawaikara:overlay:hidden',
  },
  media: {
    togglePictureInPicture: 'kawaikara:media:toggle-picture-in-picture',
    toggleGamePictureInPicture: 'kawaikara:media:toggle-game-picture-in-picture',
    pictureInPictureChanged: 'kawaikara:media:picture-in-picture-changed',
  },
  video: {
    openDroppedFiles: 'kawaikara:video:open-dropped-files',
    selectLocalFile: 'kawaikara:video:select-local-file',
    getPlaybackCapabilities: 'kawaikara:video:get-playback-capabilities',
    getOpenRequest: 'kawaikara:video:get-open-request',
    activateLocalFile: 'kawaikara:video:activate-local-file',
    openRequestChanged: 'kawaikara:video:open-request-changed',
    librarySnapshot: 'kawaikara:video:library-snapshot',
    listDirectory: 'kawaikara:video:list-directory',
    openPath: 'kawaikara:video:open-path',
    searchDirectory: 'kawaikara:video:search-directory',
    pinFolder: 'kawaikara:video:pin-folder',
    removeFolder: 'kawaikara:video:remove-folder',
    openLibraryItem: 'kawaikara:video:open-library-item',
    thumbnail: 'kawaikara:video:thumbnail',
    presentationChanged: 'kawaikara:video:presentation-changed',
    pictureInPictureChanged: 'kawaikara:video:picture-in-picture-changed',
    visibilityChanged: 'kawaikara:video:visibility-changed',
    recoverPlaybackRenderer: 'kawaikara:video:recover-playback-renderer',
    setVolumePreference: 'kawaikara:video:set-volume-preference',
  },
  downloads: {
    openYouTube: 'kawaikara:downloads:open-youtube',
    status: 'kawaikara:downloads:status',
    install: 'kawaikara:downloads:install',
    open: 'kawaikara:downloads:open',
    openReleasePage: 'kawaikara:downloads:open-release-page',
  },
  preferences: {
    get: 'kawaikara:preferences:get',
    previewTheme: 'kawaikara:preferences:preview-theme',
    update: 'kawaikara:preferences:update',
  },
  data: {
    clearBrowserProfile: 'kawaikara:data:clear-browser-profile',
    clearIsolatedSite: 'kawaikara:data:clear-isolated-site',
    clearApplicationCache: 'kawaikara:data:clear-application-cache',
    resetApplication: 'kawaikara:data:reset-application',
  },
} as const);

type LeafValues<T> = T extends IpcChannelName
  ? T
  : T extends object
    ? { [K in keyof T]: LeafValues<T[K]> }[keyof T]
    : never;

/** Union of every registered IPC channel literal. */
export type IpcChannel = LeafValues<typeof IPC_CHANNELS>;

/** Namespace-shaped type when consumers need the complete channel tree. */
export type IpcChannels = typeof IPC_CHANNELS;

export type OverlayView = 'menu' | 'preference' | 'update';

export type PictureInPictureStatus =
  | 'entered'
  | 'exited'
  | 'no-video'
  | 'not-ready'
  | 'disabled'
  | 'unsupported'
  | 'failed';

export type PictureInPictureMode = 'video' | 'window';

export interface PictureInPictureResult {
  readonly mode?: PictureInPictureMode;
  readonly status: PictureInPictureStatus;
}

export interface SiteMenuItem {
  readonly id: string;
  readonly bundleId: string;
  readonly title: string;
  readonly addressHosts: readonly string[];
  readonly category: string;
  readonly icon?: string;
  readonly panels: readonly PluginViewPanelInfo[];
  readonly order: number;
  readonly defaultShortcut: string;
  readonly actionShortcuts: readonly ProviderActionShortcutInfo[];
  readonly supportedLocales: readonly string[];
  readonly defaultLocale: string;
  readonly defaultBrowserProfileId?: string;
  readonly drm: boolean;
  readonly pictureInPictureEnabled: boolean;
  readonly isCurrent: boolean;
}

export interface PluginViewPanelInfo {
  /** Runtime identity composed from owner id and its locally scoped panel id. */
  readonly id: string;
  readonly title: ProviderLocalizedText;
  readonly order: number;
  readonly content:
    | { readonly kind: 'internal'; readonly viewId: string }
    | { readonly kind: 'html'; readonly html: string };
}

export interface ProviderActionShortcutInfo {
  readonly id: string;
  readonly title: ProviderLocalizedText;
  readonly description?: ProviderLocalizedText;
  readonly defaultKey: string;
  readonly action: string;
}

export interface ProviderRuntimeInfo {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly settings: readonly ProviderSettingCategoryContribution[];
  readonly shortFormVideo?: ShortFormVideoContribution;
}

export type BrowserProfileSource = 'user' | 'plugin';

export interface BrowserProfileInfo {
  /** Globally unique runtime id, such as plugin:<plugin-id>:<profile-id>. */
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly persistent: boolean;
  readonly source: BrowserProfileSource;
  readonly pluginId?: string;
  readonly pluginName?: string;
}

export interface UserBrowserProfile {
  /** Stable user profile id. The visible name may be changed independently. */
  readonly id: string;
  readonly name: string;
  readonly persistent: boolean;
}

export interface BundleRuntimeInfo {
  readonly kind: 'bundle';
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly providerCount: number;
  readonly pluginCount: number;
  readonly supportedLocales: readonly string[];
  readonly defaultLocale: string;
  readonly browserProfiles: readonly BrowserProfileInfo[];
  readonly providers: readonly ProviderRuntimeInfo[];
}

export type BundleStatus = 'active' | 'restart-required' | 'failed';
export type BundleSource = 'built-in' | 'user';

export interface BundleInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  /** Whether the Bundle top-level manifest provides an update source. */
  readonly updatable: boolean;
  /** @deprecated Use updatable. Resolver-based updates do not expose a URL. */
  readonly updateUrl?: string;
  readonly kind: 'bundle' | 'unknown';
  readonly source: BundleSource;
  readonly status: BundleStatus;
  readonly providerCount: number;
  readonly pluginCount: number;
  readonly permissions: readonly string[];
  readonly error?: string;
}

export type BundleInstallResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'installed'; readonly bundle: BundleInfo };

export type BundleUpdateResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'updated'; readonly bundle: BundleInfo };

export type BundleRemoveResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'removed'; readonly bundleId: string };

export type ApplicationDataActionResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'cleared' }
  | { readonly status: 'restarting' };

export interface ApplicationInfo {
  readonly name: string;
  readonly version: string;
  readonly siteApiVersion: number;
  readonly electronVersion: string;
  readonly chromeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly buildChannel: ReleaseChannel;
  readonly updateChannelLocked: boolean;
}

export interface DisplayInfo {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly scaleFactor: number;
  readonly primary: boolean;
  readonly current: boolean;
}

export type ApplicationLinkId =
  | 'website'
  | 'github'
  | 'discord'
  | 'developerYouTube';

export interface DeveloperYouTubeStatus {
  readonly isLive: boolean;
  readonly checkedAt: string;
  readonly error?: string;
}

export type UpdateCheckStatus =
  | 'up-to-date'
  | 'update-available'
  | 'unsupported'
  | 'error';

export interface ApplicationUpdateCheckResult {
  readonly status: UpdateCheckStatus;
  readonly channel: ReleaseChannel;
  readonly currentVersion: string;
  readonly latestVersion?: string;
  readonly error?: string;
}

export type ApplicationUpdatePhase =
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'unsupported'
  | 'error';

export interface ApplicationUpdateProgress {
  readonly percent: number;
  readonly bytesPerSecond: number;
  readonly transferred: number;
  readonly total: number;
}

export interface ApplicationUpdatePanelState {
  readonly phase: ApplicationUpdatePhase;
  readonly origin: 'manual' | 'automatic';
  readonly channel: ReleaseChannel;
  readonly currentVersion: string;
  readonly latestVersion?: string;
  readonly releaseNotes?: string;
  readonly progress?: ApplicationUpdateProgress;
  readonly error?: string;
}

export type AppLocale = 'system' | 'ko-KR' | 'en-US' | 'ja-JP';
export type AppTheme = 'dark' | 'light';
export type GraphicsMode = 'native' | 'capture' | 'software';
export type DevToolsMode = 'left' | 'right' | 'bottom' | 'undocked' | 'detach';
export type VideoControlsLayout = 'inline' | 'overlay';
export type LogLevelPreference =
  | 'error'
  | 'warn'
  | 'info'
  | 'verbose'
  | 'debug'
  | 'none';
/** Kept for preference-file compatibility. The global app locale is authoritative. */
export type ScopedLocale = 'inherit' | AppLocale | (string & {});
export type ProviderSettingValue = SiteProviderSettingValue;
export type ProviderSettingRecord = Readonly<
  Record<string, ProviderSettingValue>
>;

export interface PreferenceState {
  readonly alwaysOnTop: boolean;
  /** Selects native GPU, capture-compatible GPU, or process-wide software rendering. */
  readonly graphicsMode: GraphicsMode;
  readonly openMenuOnStartup: boolean;
  readonly closeMenuOnEscape: boolean;
  readonly closeMenuOnOutsideClick: boolean;
  readonly automaticUpdates: boolean;
  readonly updateChannel: ReleaseChannel;
  readonly defaultSiteId: string;
  readonly devToolsMode: DevToolsMode;
  readonly appLocale: AppLocale;
  readonly appTheme: AppTheme;
  readonly pictureInPicturePlacement: PictureInPicturePlacementPreference;
  readonly pictureInPicturePortraitSize: PictureInPictureSizePreference;
  readonly pictureInPictureSize: PictureInPictureSizePreference;
  /** @deprecated Locale overrides are cleared when global preferences are saved. */
  readonly pluginLocales: Readonly<Record<string, ScopedLocale>>;
  /** @deprecated Locale overrides are cleared when global preferences are saved. */
  readonly siteLocales: Readonly<Record<string, ScopedLocale>>;
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
  readonly logLevel: LogLevelPreference;
  readonly shortcuts: Readonly<Record<string, string>>;
}

export type PreferencePatch = Partial<PreferenceState>;

export interface PreferenceUpdateOptions {
  /** Required when the patch changes the startup-only Electron graphics mode. */
  readonly restartForGraphicsChange?: boolean;
}

export type SiteAddressOpenResult =
  | { readonly status: 'opened'; readonly siteId: string }
  | { readonly status: 'unsupported' };

export interface VideoPresentationState {
  readonly ready: boolean;
  readonly width: number;
  readonly height: number;
}

export type VideoOpenRequest =
  | {
      readonly kind: 'local';
      readonly displayName: string;
      readonly path: string;
      readonly directory: string;
      readonly url: string;
    }
  | {
      readonly kind: 'folder';
      readonly displayName: string;
      readonly path: string;
    }
  | {
      readonly kind: 'youtube';
      readonly url: string;
    };

export interface VideoLibraryLocation {
  readonly kind: 'drive' | 'system' | 'pinned';
  readonly name: string;
  readonly path: string;
}

export interface VideoLibraryFolder {
  readonly name: string;
  readonly path: string;
  readonly pinned: boolean;
  readonly lastOpenedAt: string;
}

export interface VideoLibraryVideo {
  readonly name: string;
  readonly path: string;
  readonly directory: string;
  readonly lastOpenedAt: string;
}

export interface VideoLibrarySnapshot {
  readonly lastDirectory?: string;
  readonly locations: readonly VideoLibraryLocation[];
  readonly favoriteFolders: readonly VideoLibraryFolder[];
  readonly recentFolders: readonly VideoLibraryFolder[];
  readonly recentVideos: readonly VideoLibraryVideo[];
}

export interface VideoDirectoryEntry {
  readonly kind: 'directory' | 'video';
  readonly name: string;
  readonly path: string;
  readonly size?: number;
  readonly modifiedAt?: string;
}

export interface VideoDirectoryListing {
  readonly directory: string;
  readonly displayName: string;
  readonly parent?: string;
  readonly entries: readonly VideoDirectoryEntry[];
}

export type VideoPathOpenResult =
  | {
      readonly kind: 'directory';
      readonly listing: VideoDirectoryListing;
    }
  | {
      readonly kind: 'video';
      readonly directory: string;
      readonly request: Extract<VideoOpenRequest, { readonly kind: 'local' }>;
    };

export interface VideoLibraryApi {
  getSnapshot(): Promise<VideoLibrarySnapshot>;
  listDirectory(path: string): Promise<VideoDirectoryListing>;
  openPath(path: string): Promise<VideoPathOpenResult>;
  searchDirectory(path: string, query: string): Promise<VideoDirectoryEntry[]>;
  setFolderPinned(path: string, pinned: boolean): Promise<VideoLibrarySnapshot>;
  removeFolder(path: string): Promise<VideoLibrarySnapshot>;
  openItem(path: string): Promise<void>;
  getThumbnail(path: string): Promise<string | undefined>;
}

export interface VideoPlaybackCapabilities {
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly nativeBackendAvailable: boolean;
  /** False when app.disableHardwareAcceleration() selected software presentation. */
  readonly electronGpuAccelerationEnabled: boolean;
  /** True only when MPV_HWDEC explicitly disables native hardware decoding. */
  readonly hardwareAccelerationDisabled: boolean;
}

export interface KawaikaraRendererApi {
  application: {
    getInfo(): Promise<ApplicationInfo>;
    getMessages(locale?: AppLocale): Promise<RendererMessages>;
    listDisplays(): Promise<DisplayInfo[]>;
    openLink(id: ApplicationLinkId): Promise<void>;
    openDevTools(mode: DevToolsMode): Promise<void>;
    openLogDirectory(): Promise<void>;
    getDeveloperYouTubeStatus(): Promise<DeveloperYouTubeStatus>;
    checkForUpdates(): Promise<ApplicationUpdateCheckResult>;
    getUpdateState(): Promise<ApplicationUpdatePanelState | undefined>;
    downloadUpdate(): Promise<ApplicationUpdatePanelState>;
    installUpdate(): Promise<void>;
    copyText(value: string): Promise<void>;
    onUpdateStateChanged(
      handler: (state: ApplicationUpdatePanelState) => void,
    ): () => void;
    isFullScreen(): Promise<boolean>;
    exitFullScreen(): Promise<void>;
  };
  bundles: {
    runtime(): Promise<BundleRuntimeInfo[]>;
    list(): Promise<BundleInfo[]>;
    install(locale: AppLocale): Promise<BundleInstallResult>;
    update(id: string, locale: AppLocale): Promise<BundleUpdateResult>;
    remove(id: string, locale: AppLocale): Promise<BundleRemoveResult>;
  };
  sites: {
    list(): Promise<SiteMenuItem[]>;
    currentAddress(): Promise<string>;
    open(id: string): Promise<void>;
    openAddress(value: string): Promise<SiteAddressOpenResult>;
  };
  videoLibrary: VideoLibraryApi;
  overlay: {
    close(): Promise<void>;
    setView(view: OverlayView): Promise<void>;
    onShowMenu(handler: () => void): () => void;
    onShowPreferences(handler: () => void): () => void;
    onShowUpdate(
      handler: (state: ApplicationUpdatePanelState) => void,
    ): () => void;
    onRequestClose(handler: () => void): () => void;
    onHidden(handler: () => void): () => void;
  };
  media: {
    togglePictureInPicture(): Promise<PictureInPictureResult>;
    toggleGamePictureInPicture(): Promise<PictureInPictureResult>;
    onPictureInPictureChanged(
      handler: (result: PictureInPictureResult) => void,
    ): () => void;
  };
  preferences: {
    get(): Promise<PreferenceState>;
    previewTheme(theme: AppTheme): Promise<void>;
    update(
      patch: PreferencePatch,
      options?: PreferenceUpdateOptions,
    ): Promise<PreferenceState>;
  };
  data: {
    clearBrowserProfile(
      profileId: string,
      locale: AppLocale,
    ): Promise<ApplicationDataActionResult>;
    clearIsolatedSite(
      siteId: string,
      locale: AppLocale,
    ): Promise<ApplicationDataActionResult>;
    clearApplicationCache(locale: AppLocale): Promise<ApplicationDataActionResult>;
    resetApplication(locale: AppLocale): Promise<ApplicationDataActionResult>;
  };
}

export interface KawaikaraVideoApi {
  application: {
    getMessages(locale?: AppLocale): Promise<RendererMessages>;
    isFullScreen(): Promise<boolean>;
    exitFullScreen(): Promise<void>;
    togglePictureInPicture(): Promise<PictureInPictureResult>;
    recoverPlaybackRenderer(): Promise<boolean>;
    onFullScreenChanged(handler: (fullScreen: boolean) => void): () => void;
    onPictureInPictureChanged(handler: (active: boolean) => void): () => void;
    onVisibilityChanged(handler: (visible: boolean) => void): () => void;
  };
  source: {
    selectLocalFile(): Promise<VideoOpenRequest | null>;
    getPlaybackCapabilities(): Promise<VideoPlaybackCapabilities>;
    getOpenRequest(): Promise<VideoOpenRequest | null>;
    activateLocalFile(
      path: string,
    ): Promise<Extract<VideoOpenRequest, { readonly kind: 'local' }>>;
    onOpenRequest(handler: (request: VideoOpenRequest) => void): () => void;
  };
  downloads: {
    getStatus(): Promise<ExternalDownloaderStatus>;
    install(url?: string): Promise<ExternalDownloaderInstallResult>;
    open(url: string): Promise<ExternalDownloaderOpenResult>;
    openReleasePage(): Promise<void>;
  };
  preferences: {
    get(): Promise<PreferenceState>;
    setVideoVolume(value: number): Promise<number>;
  };
  presentation: {
    update(state: VideoPresentationState): void;
  };
  videoLibrary: VideoLibraryApi;
}
