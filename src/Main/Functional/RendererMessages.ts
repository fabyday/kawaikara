import type { AppLocale } from '../../Common/IPC';
import en from '../../../locales/en.json';
import ja from '../../../locales/ja.json';
import ko from '../../../locales/ko.json';

export interface AppMessages {
  readonly chooseSite: string;
  readonly openPreferences: string;
  readonly closeMenu: string;
  readonly menuHint: string;
  readonly addressPlaceholder: string;
  readonly addressHelp: string;
  readonly unsupportedAddress: string;
  readonly pictureInPicture: string;
  readonly automaticPictureInPicture: string;
  readonly gamePictureInPicture: string;
  readonly pictureInPictureSettings: string;
  readonly pictureInPictureSize: string;
  readonly pictureInPictureSizeDescription: string;
  readonly pictureInPicturePortraitSize: string;
  readonly pictureInPicturePortraitSizeDescription: string;
  readonly pipSizeCompact: string;
  readonly pipSizeMedium: string;
  readonly pipSizeLarge: string;
  readonly pipSizeCustom: string;
  readonly pipWidth: string;
  readonly pipHeight: string;
  readonly pixels: string;
  readonly pictureInPicturePosition: string;
  readonly pictureInPicturePositionDescription: string;
  readonly pipPositionTopLeft: string;
  readonly pipPositionTopRight: string;
  readonly pipPositionBottomLeft: string;
  readonly pipPositionBottomRight: string;
  readonly pipPositionLast: string;
  readonly pictureInPictureMonitor: string;
  readonly pictureInPictureMonitorDescription: string;
  readonly pipMonitorCurrent: string;
  readonly pipMonitorVideo: string;
  readonly pipMonitorLast: string;
  readonly pipMonitorDisplay: string;
  readonly primaryDisplay: string;
  readonly unavailableDisplay: string;
  readonly pipNoVideo: string;
  readonly pipNotReady: string;
  readonly pipDisabled: string;
  readonly pipUnsupported: string;
  readonly pipFailed: string;
  readonly selected: string;
  readonly preference: string;
  readonly configureViewer: string;
  readonly backToSites: string;
  readonly closePreferences: string;
  readonly general: string;
  readonly browserProfiles: string;
  readonly browserProfilesDescription: string;
  readonly browserProfile: string;
  readonly pluginProfiles: string;
  readonly userProfiles: string;
  readonly pluginProfile: string;
  readonly userProfile: string;
  readonly profileName: string;
  readonly profileNamePlaceholder: string;
  readonly addProfile: string;
  readonly removeProfile: string;
  readonly noUserProfiles: string;
  readonly persistentProfile: string;
  readonly siteProfileAssignments: string;
  readonly siteProfileAssignmentsDescription: string;
  readonly isolatedProfile: string;
  readonly isolatedProfileDescription: string;
  readonly sharedProfileDescription: string;
  readonly drmProfileWarning: string;
  readonly shortcuts: string;
  readonly bundles: string;
  readonly bundleManagement: string;
  readonly bundlesDescription: string;
  readonly addBundle: string;
  readonly backToBundles: string;
  readonly bundleTrustWarning: string;
  readonly installedBundles: string;
  readonly builtInBundle: string;
  readonly userBundle: string;
  readonly bundleActive: string;
  readonly bundleRestartRequired: string;
  readonly bundleFailed: string;
  readonly bundleInstallSuccess: string;
  readonly noBundles: string;
  readonly emptyBundle: string;
  readonly permissions: string;
  readonly noProviderSettings: string;
  readonly remove: string;
  readonly showMore: string;
  readonly selectAll: string;
  readonly clearSelection: string;
  readonly removeSelected: string;
  readonly bundleListCount: string;
  readonly appInfo: string;
  readonly developer: string;
  readonly developerTools: string;
  readonly developerToolsDescription: string;
  readonly devToolsPlacement: string;
  readonly devToolsPlacementLeft: string;
  readonly devToolsPlacementRight: string;
  readonly devToolsPlacementBottom: string;
  readonly devToolsPlacementUndocked: string;
  readonly devToolsPlacementDetach: string;
  readonly openDevTools: string;
  readonly viewer: string;
  readonly shortFormVideo: string;
  readonly shortFormVideoDescription: string;
  readonly youtubeShortsAutoAdvance: string;
  readonly youtubeShortsAutoAdvanceDescription: string;
  readonly chzzkClipsAutoAdvance: string;
  readonly chzzkClipsAutoAdvanceDescription: string;
  readonly performance: string;
  readonly graphicsMode: string;
  readonly graphicsModeDescription: string;
  readonly graphicsModeNative: string;
  readonly graphicsModeNativeDescription: string;
  readonly graphicsModeCompatible: string;
  readonly graphicsModeCompatibleDescription: string;
  readonly graphicsModeSoftware: string;
  readonly graphicsModeSoftwareDescription: string;
  readonly graphicsRestartTitle: string;
  readonly graphicsRestartDescription: string;
  readonly applyAndRestart: string;
  readonly alwaysOnTop: string;
  readonly alwaysOnTopDescription: string;
  readonly openMenuOnStartup: string;
  readonly openMenuOnStartupDescription: string;
  readonly closeMenuOnEscape: string;
  readonly closeMenuOnEscapeDescription: string;
  readonly closeMenuOnOutsideClick: string;
  readonly closeMenuOnOutsideClickDescription: string;
  readonly menuOrder: string;
  readonly menuOrderDescription: string;
  readonly editMenuOrder: string;
  readonly menuOrderEditorDescription: string;
  readonly menuOrderCategories: string;
  readonly menuOrderSites: string;
  readonly dragToReorder: string;
  readonly resetMenuOrder: string;
  readonly done: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly automaticUpdates: string;
  readonly automaticUpdatesDescription: string;
  readonly defaultSite: string;
  readonly defaultSiteDescription: string;
  readonly language: string;
  readonly appearance: string;
  readonly appTheme: string;
  readonly appThemeDescription: string;
  readonly darkTheme: string;
  readonly lightTheme: string;
  readonly appLanguage: string;
  readonly appLanguageDescription: string;
  readonly globalLanguageDescription: string;
  readonly pluginLanguages: string;
  readonly siteLanguages: string;
  readonly inherit: string;
  readonly system: string;
  readonly korean: string;
  readonly english: string;
  readonly japanese: string;
  readonly appShortcuts: string;
  readonly video: string;
  readonly videoSettingsDescription: string;
  readonly videoSeekSeconds: string;
  readonly videoSeekSecondsDescription: string;
  readonly videoOverlayHideSeconds: string;
  readonly videoOverlayHideSecondsDescription: string;
  readonly videoControlsLayout: string;
  readonly videoControlsInline: string;
  readonly videoControlsInlineDescription: string;
  readonly videoControlsOverlay: string;
  readonly videoControlsOverlayDescription: string;
  readonly seconds: string;
  readonly logLevel: string;
  readonly logLevelDescription: string;
  readonly logLevelError: string;
  readonly logLevelErrorDescription: string;
  readonly logLevelWarn: string;
  readonly logLevelWarnDescription: string;
  readonly logLevelInfo: string;
  readonly logLevelInfoDescription: string;
  readonly logLevelVerbose: string;
  readonly logLevelVerboseDescription: string;
  readonly logLevelDebug: string;
  readonly logLevelDebugDescription: string;
  readonly logLevelNone: string;
  readonly logLevelNoneDescription: string;
  readonly videoShortcuts: string;
  readonly videoShortcutsDescription: string;
  readonly shortFormVideoShortcuts: string;
  readonly shortFormVideoShortcutsDescription: string;
  readonly providerShortcuts: string;
  readonly menuCategoryShortcuts: string;
  readonly menuCategoryShortcutsDescription: string;
  readonly categoryPosition: string;
  readonly currentCategory: string;
  readonly siteShortcuts: string;
  readonly shortcutCapture: string;
  readonly shortcutNames: Readonly<Record<string, string>>;
  readonly categoryLabels: Readonly<Record<string, string>>;
  readonly disabled: string;
  readonly empty: string;
  readonly duplicateShortcut: string;
  readonly reset: string;
  readonly defaultValue: string;
  readonly savedAutomatically: string;
  readonly unsavedChanges: string;
  readonly saveDescription: string;
  readonly saveChanges: string;
  readonly discardChangesTitle: string;
  readonly discardChangesDescription: string;
  readonly keepEditing: string;
  readonly discardAndLeave: string;
  readonly shortcutConflict: string;
  readonly shortcutConflictDescription: string;
  readonly cancel: string;
  readonly overwrite: string;
  readonly loading: string;
  readonly version: string;
  readonly appDescription: string;
  readonly channel: string;
  readonly stableChannel: string;
  readonly stagingChannel: string;
  readonly nightlyChannel: string;
  readonly checkForUpdates: string;
  readonly checkingForUpdates: string;
  readonly latestVersion: string;
  readonly updateAvailable: string;
  readonly updateUnavailable: string;
  readonly updateCheckFailed: string;
  readonly runtime: string;
  readonly platform: string;
  readonly diagnosticLogs: string;
  readonly diagnosticLogsDescription: string;
  readonly openLogDirectory: string;
  readonly developerLinks: string;
  readonly website: string;
  readonly github: string;
  readonly discord: string;
  readonly developerYouTube: string;
  readonly liveNow: string;
  readonly offline: string;
  readonly liveStatusUnavailable: string;
  readonly checkingLive: string;
  readonly installedPlugins: string;
  readonly plugins: string;
  readonly sites: string;
}

export interface VideoMessages {
  readonly welcome: string;
  readonly changeSource: string;
  readonly sourceDescription: string;
  readonly openSource: string;
  readonly openFolder: string;
  readonly openLocal: string;
  readonly youtubeDownload: string;
  readonly hlsUrl: string;
  readonly playHls: string;
  readonly invalidHls: string;
  readonly shortcutHint: string;
  readonly loading: string;
  readonly play: string;
  readonly pause: string;
  readonly controls: string;
  readonly timeline: string;
  readonly volume: string;
  readonly live: string;
  readonly playbackFailed: string;
  readonly chromiumPlaybackFailed: string;
  readonly runtimeMissing: string;
  readonly chromiumFallback: string;
  readonly detectingBackend: string;
  readonly intelMacFallback: string;
  readonly nativeErrorFallback: string;
  readonly nativeUnavailableFallback: string;
  readonly softwareRenderingWarning: string;
  readonly captureCompatibleRenderingWarning: string;
}

export interface VideoBrowserMessages {
  readonly library: string;
  readonly computer: string;
  readonly description: string;
  readonly drives: string;
  readonly favorites: string;
  readonly kawaikaraFavorites: string;
  readonly noKawaikaraFavorites: string;
  readonly addKawaikaraFavorite: string;
  readonly removeKawaikaraFavorite: string;
  readonly favoriteFailed: string;
  readonly noDrives: string;
  readonly noFavorites: string;
  readonly folder: string;
  readonly home: string;
  readonly up: string;
  readonly address: string;
  readonly addressPlaceholder: string;
  readonly go: string;
  readonly search: string;
  readonly searchPlaceholder: string;
  readonly emptyFolder: string;
  readonly emptyDescription: string;
  readonly noSearchResults: string;
  readonly noSearchDescription: string;
  readonly selectFile: string;
  readonly selectFileDescription: string;
  readonly pathUnavailable: string;
  readonly folderUnavailable: string;
  readonly searchFailed: string;
  readonly supportedFiles: string;
  readonly hls: string;
  readonly close: string;
}

export interface VideoLibraryMessages {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly folders: string;
  readonly videos: string;
  readonly noFolders: string;
  readonly noFoldersHelp: string;
  readonly noVideos: string;
  readonly noVideosHelp: string;
  readonly pinned: string;
  readonly pin: string;
  readonly unpin: string;
  readonly remove: string;
}

export interface RendererMessages {
  readonly locale: string;
  readonly app: AppMessages;
  readonly video: VideoMessages;
  readonly videoBrowser: VideoBrowserMessages;
  readonly videoLibrary: VideoLibraryMessages;
}

interface RendererLocaleMessages {
  readonly app: AppMessages;
  readonly video: VideoMessages;
  readonly videoBrowser: VideoBrowserMessages;
  readonly videoLibrary: VideoLibraryMessages;
}

const LOCALES: Readonly<Record<'en' | 'ko' | 'ja', RendererLocaleMessages>> = {
  en,
  ko,
  ja,
};

export function getAppMessages(
  locale: AppLocale,
  systemLocale: string,
): AppMessages {
  return LOCALES[toSupportedLanguage(resolveLocale(locale, systemLocale))].app;
}

export function getRendererMessages(
  locale: AppLocale,
  systemLocale: string,
): RendererMessages {
  const resolved = resolveLocale(locale, systemLocale);
  const messages = LOCALES[toSupportedLanguage(resolved)];
  return {
    locale: resolved,
    app: messages.app,
    video: messages.video,
    videoBrowser: messages.videoBrowser,
    videoLibrary: messages.videoLibrary,
  };
}

function resolveLocale(locale: AppLocale, systemLocale: string): string {
  return locale === 'system' ? systemLocale : locale;
}

function toSupportedLanguage(locale: string): keyof typeof LOCALES {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('ja')) return 'ja';
  return 'en';
}
