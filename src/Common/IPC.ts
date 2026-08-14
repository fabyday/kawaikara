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
    open: 'kawaikara:sites:open',
  },
  application: {
    info: 'kawaikara:application:info',
    listDisplays: 'kawaikara:application:list-displays',
    openLink: 'kawaikara:application:open-link',
    developerYouTubeStatus: 'kawaikara:application:developer-youtube-status',
    checkForUpdates: 'kawaikara:application:check-for-updates',
  },
  plugins: {
    list: 'kawaikara:plugins:list',
  },
  overlay: {
    close: 'kawaikara:overlay:close',
    setView: 'kawaikara:overlay:set-view',
    editingChanged: 'kawaikara:overlay:editing-changed',
    showMenu: 'kawaikara:overlay:show-menu',
    showPreferences: 'kawaikara:overlay:show-preferences',
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
    getOpenRequest: 'kawaikara:video:get-open-request',
    openRequestChanged: 'kawaikara:video:open-request-changed',
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
    update: 'kawaikara:preferences:update',
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

export type OverlayView = 'menu' | 'preference';

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
  readonly pluginId: string;
  readonly title: string;
  readonly category: string;
  readonly icon?: string;
  readonly order: number;
  readonly defaultShortcut: string;
  readonly supportedLocales: readonly string[];
  readonly defaultLocale: string;
  readonly defaultBrowserProfileId?: string;
  readonly drm: boolean;
  readonly isCurrent: boolean;
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

export interface PluginInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly siteCount: number;
  readonly supportedLocales: readonly string[];
  readonly defaultLocale: string;
  readonly browserProfiles: readonly BrowserProfileInfo[];
}

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

export type AppLocale = 'system' | 'ko-KR' | 'en-US' | 'ja-JP';
/** Kept for preference-file compatibility. The global app locale is authoritative. */
export type ScopedLocale = 'inherit' | AppLocale | (string & {});

export interface PreferenceState {
  readonly alwaysOnTop: boolean;
  readonly openMenuOnStartup: boolean;
  readonly closeMenuOnEscape: boolean;
  readonly closeMenuOnOutsideClick: boolean;
  readonly automaticUpdates: boolean;
  readonly updateChannel: ReleaseChannel;
  readonly defaultSiteId: string;
  readonly appLocale: AppLocale;
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
  /** Category ids in the order selected by the user. Unknown ids are ignored. */
  readonly menuCategoryOrder: readonly string[];
  /** Site ids in the order selected by the user, applied within each category. */
  readonly menuSiteOrder: readonly string[];
  readonly shortcuts: Readonly<Record<string, string>>;
}

export type PreferencePatch = Partial<PreferenceState>;

export type VideoOpenRequest =
  | {
      readonly kind: 'local';
      readonly displayName: string;
      readonly url: string;
    }
  | {
      readonly kind: 'youtube';
      readonly url: string;
    };

export interface KawaikaraRendererApi {
  application: {
    getInfo(): Promise<ApplicationInfo>;
    listDisplays(): Promise<DisplayInfo[]>;
    openLink(id: ApplicationLinkId): Promise<void>;
    getDeveloperYouTubeStatus(): Promise<DeveloperYouTubeStatus>;
    checkForUpdates(channel?: ReleaseChannel): Promise<ApplicationUpdateCheckResult>;
  };
  plugins: {
    list(): Promise<PluginInfo[]>;
  };
  sites: {
    list(): Promise<SiteMenuItem[]>;
    open(id: string): Promise<void>;
  };
  overlay: {
    close(): Promise<void>;
    setView(view: OverlayView): Promise<void>;
    onShowMenu(handler: () => void): () => void;
    onShowPreferences(handler: () => void): () => void;
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
    update(patch: PreferencePatch): Promise<PreferenceState>;
  };
}

export interface KawaikaraVideoApi {
  source: {
    getOpenRequest(): Promise<VideoOpenRequest | null>;
    onOpenRequest(handler: (request: VideoOpenRequest) => void): () => void;
  };
  downloads: {
    getStatus(): Promise<ExternalDownloaderStatus>;
    install(url?: string): Promise<ExternalDownloaderInstallResult>;
    open(url: string): Promise<ExternalDownloaderOpenResult>;
    openReleasePage(): Promise<void>;
  };
}
