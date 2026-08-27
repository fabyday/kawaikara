import type { AppLocale } from '../../Common/IPC';
import en from '../../../locales/en.json';
import ja from '../../../locales/ja.json';
import ko from '../../../locales/ko.json';

/** Describes the app messages contract. */
export interface AppMessages {
  /** The title value. */
  readonly title: string;
  /** The choose site value. */
  readonly chooseSite: string;
  /** The open preferences value. */
  readonly openPreferences: string;
  /** The close menu value. */
  readonly closeMenu: string;
  /** The menu hint value. */
  readonly menuHint: string;
  /** The address placeholder value. */
  readonly addressPlaceholder: string;
  /** The address help value. */
  readonly addressHelp: string;
  /** The unsupported address value. */
  readonly unsupportedAddress: string;
  /** The address go value. */
  readonly addressGo: string;
  /** The copy address value. */
  readonly copyAddress: string;
  /** The address copied value. */
  readonly addressCopied: string;
  /** The go back value. */
  readonly goBack: string;
  /** The go forward value. */
  readonly goForward: string;
  /** The picture in picture value. */
  readonly pictureInPicture: string;
  /** The automatic picture in picture value. */
  readonly automaticPictureInPicture: string;
  /** The game picture in picture value. */
  readonly gamePictureInPicture: string;
  /** The picture in picture settings value. */
  readonly pictureInPictureSettings: string;
  /** The picture in picture size value. */
  readonly pictureInPictureSize: string;
  /** The picture in picture size description value. */
  readonly pictureInPictureSizeDescription: string;
  /** The picture in picture portrait size value. */
  readonly pictureInPicturePortraitSize: string;
  /** The picture in picture portrait size description value. */
  readonly pictureInPicturePortraitSizeDescription: string;
  /** The PiP size compact value. */
  readonly pipSizeCompact: string;
  /** The PiP size medium value. */
  readonly pipSizeMedium: string;
  /** The PiP size large value. */
  readonly pipSizeLarge: string;
  /** The PiP size custom value. */
  readonly pipSizeCustom: string;
  /** The PiP width value. */
  readonly pipWidth: string;
  /** The PiP height value. */
  readonly pipHeight: string;
  /** The pixels value. */
  readonly pixels: string;
  /** The picture in picture position value. */
  readonly pictureInPicturePosition: string;
  /** The picture in picture position description value. */
  readonly pictureInPicturePositionDescription: string;
  /** The PiP position top left value. */
  readonly pipPositionTopLeft: string;
  /** The PiP position top right value. */
  readonly pipPositionTopRight: string;
  /** The PiP position bottom left value. */
  readonly pipPositionBottomLeft: string;
  /** The PiP position bottom right value. */
  readonly pipPositionBottomRight: string;
  /** The PiP position last value. */
  readonly pipPositionLast: string;
  /** The picture in picture monitor value. */
  readonly pictureInPictureMonitor: string;
  /** The picture in picture monitor description value. */
  readonly pictureInPictureMonitorDescription: string;
  /** The PiP monitor current value. */
  readonly pipMonitorCurrent: string;
  /** The PiP monitor video value. */
  readonly pipMonitorVideo: string;
  /** The PiP monitor last value. */
  readonly pipMonitorLast: string;
  /** The PiP monitor display value. */
  readonly pipMonitorDisplay: string;
  /** The primary display value. */
  readonly primaryDisplay: string;
  /** The unavailable display value. */
  readonly unavailableDisplay: string;
  /** The PiP no video value. */
  readonly pipNoVideo: string;
  /** The PiP not ready value. */
  readonly pipNotReady: string;
  /** The PiP disabled value. */
  readonly pipDisabled: string;
  /** The PiP unsupported value. */
  readonly pipUnsupported: string;
  /** The PiP failed value. */
  readonly pipFailed: string;
  /** The selected value. */
  readonly selected: string;
  /** The preference value. */
  readonly preference: string;
  /** The configure viewer value. */
  readonly configureViewer: string;
  /** The back to sites value. */
  readonly backToSites: string;
  /** The close preferences value. */
  readonly closePreferences: string;
  /** The general value. */
  readonly general: string;
  /** The browser profiles value. */
  readonly browserProfiles: string;
  /** The browser profiles description value. */
  readonly browserProfilesDescription: string;
  /** The browser profile value. */
  readonly browserProfile: string;
  /** The plugin profiles value. */
  readonly pluginProfiles: string;
  /** The user profiles value. */
  readonly userProfiles: string;
  /** The plugin profile value. */
  readonly pluginProfile: string;
  /** The user profile value. */
  readonly userProfile: string;
  /** The profile name value. */
  readonly profileName: string;
  /** The profile name placeholder value. */
  readonly profileNamePlaceholder: string;
  /** The add profile value. */
  readonly addProfile: string;
  /** The clear profile data value. */
  readonly clearProfileData: string;
  /** The clear site data value. */
  readonly clearSiteData: string;
  /** The data clear success value. */
  readonly dataClearSuccess: string;
  /** The remove profile value. */
  readonly removeProfile: string;
  /** The no user profiles value. */
  readonly noUserProfiles: string;
  /** The persistent profile value. */
  readonly persistentProfile: string;
  /** The site profile assignments value. */
  readonly siteProfileAssignments: string;
  /** The site profile assignments description value. */
  readonly siteProfileAssignmentsDescription: string;
  /** Whether the isolated profile option is enabled. */
  readonly isolatedProfile: string;
  /** Whether the isolated profile description option is enabled. */
  readonly isolatedProfileDescription: string;
  /** The shared profile description value. */
  readonly sharedProfileDescription: string;
  /** The default profile mismatch warning value. */
  readonly defaultProfileMismatchWarning: string;
  /** The DRM profile warning value. */
  readonly drmProfileWarning: string;
  /** The shortcuts value. */
  readonly shortcuts: string;
  /** The bundles value. */
  readonly bundles: string;
  /** The bundle management value. */
  readonly bundleManagement: string;
  /** The bundles description value. */
  readonly bundlesDescription: string;
  /** The add bundle value. */
  readonly addBundle: string;
  /** The back to bundles value. */
  readonly backToBundles: string;
  /** The bundle trust warning value. */
  readonly bundleTrustWarning: string;
  /** The installed bundles value. */
  readonly installedBundles: string;
  /** The built in bundle value. */
  readonly builtInBundle: string;
  /** The user bundle value. */
  readonly userBundle: string;
  /** The development bundle value. */
  readonly developmentBundle: string;
  /** The bundle active value. */
  readonly bundleActive: string;
  /** The bundle restart required value. */
  readonly bundleRestartRequired: string;
  /** The bundle failed value. */
  readonly bundleFailed: string;
  /** The bundle install success value. */
  readonly bundleInstallSuccess: string;
  /** The bundle update value. */
  readonly bundleUpdate: string;
  /** The bundle update unavailable value. */
  readonly bundleUpdateUnavailable: string;
  /** The bundle update success value. */
  readonly bundleUpdateSuccess: string;
  /** The bundle remove success value. */
  readonly bundleRemoveSuccess: string;
  /** The no bundles value. */
  readonly noBundles: string;
  /** The empty bundle value. */
  readonly emptyBundle: string;
  /** The permissions value. */
  readonly permissions: string;
  /** The remove value. */
  readonly remove: string;
  /** The show more value. */
  readonly showMore: string;
  /** The select all value. */
  readonly selectAll: string;
  /** The clear selection value. */
  readonly clearSelection: string;
  /** The remove selected value. */
  readonly removeSelected: string;
  /** The bundle list count value. */
  readonly bundleListCount: string;
  /** The app info value. */
  readonly appInfo: string;
  /** The developer value. */
  readonly developer: string;
  /** The developer tools value. */
  readonly developerTools: string;
  /** The developer tools description value. */
  readonly developerToolsDescription: string;
  /** The dev tools placement value. */
  readonly devToolsPlacement: string;
  /** The dev tools placement left value. */
  readonly devToolsPlacementLeft: string;
  /** The dev tools placement right value. */
  readonly devToolsPlacementRight: string;
  /** The dev tools placement bottom value. */
  readonly devToolsPlacementBottom: string;
  /** The dev tools placement undocked value. */
  readonly devToolsPlacementUndocked: string;
  /** The dev tools placement detach value. */
  readonly devToolsPlacementDetach: string;
  /** The open dev tools value. */
  readonly openDevTools: string;
  /** The open dev tools automatically value. */
  readonly openDevToolsAutomatically: string;
  /** The development mode value. */
  readonly developmentMode: string;
  /** The development mode description value. */
  readonly developmentModeDescription: string;
  /** The development trust warning value. */
  readonly developmentTrustWarning: string;
  /** The main process debugger value. */
  readonly mainProcessDebugger: string;
  /** The main process debugger description value. */
  readonly mainProcessDebuggerDescription: string;
  /** The inspector port value. */
  readonly inspectorPort: string;
  /** The inspector port description value. */
  readonly inspectorPortDescription: string;
  /** The debugger active value. */
  readonly debuggerActive: string;
  /** The debugger inactive value. */
  readonly debuggerInactive: string;
  /** The copy vs code configuration value. */
  readonly copyVsCodeConfiguration: string;
  /** The vs code configuration copied value. */
  readonly vsCodeConfigurationCopied: string;
  /** The development bundles value. */
  readonly developmentBundles: string;
  /** The development bundles description value. */
  readonly developmentBundlesDescription: string;
  /** The add development bundle value. */
  readonly addDevelopmentBundle: string;
  /** The no development bundles value. */
  readonly noDevelopmentBundles: string;
  /** The hot reload value. */
  readonly hotReload: string;
  /** The rebuild bundle value. */
  readonly rebuildBundle: string;
  /** The detach development bundle value. */
  readonly detachDevelopmentBundle: string;
  /** The development status stopped value. */
  readonly developmentStatusStopped: string;
  /** The development status watching value. */
  readonly developmentStatusWatching: string;
  /** The development status building value. */
  readonly developmentStatusBuilding: string;
  /** The development status reloading value. */
  readonly developmentStatusReloading: string;
  /** The development status active value. */
  readonly developmentStatusActive: string;
  /** The development status failed value. */
  readonly developmentStatusFailed: string;
  /** The development revision value. */
  readonly developmentRevision: string;
  /** The development output directory value. */
  readonly developmentOutputDirectory: string;
  /** The viewer value. */
  readonly viewer: string;
  /** The short form video value. */
  readonly shortFormVideo: string;
  /** The short form video description value. */
  readonly shortFormVideoDescription: string;
  /** The YouTube shorts auto advance value. */
  readonly youtubeShortsAutoAdvance: string;
  /** The YouTube shorts auto advance description value. */
  readonly youtubeShortsAutoAdvanceDescription: string;
  /** The CHZZK clips auto advance value. */
  readonly chzzkClipsAutoAdvance: string;
  /** The CHZZK clips auto advance description value. */
  readonly chzzkClipsAutoAdvanceDescription: string;
  /** The performance value. */
  readonly performance: string;
  /** The data management value. */
  readonly dataManagement: string;
  /** The restore default profiles value. */
  readonly restoreDefaultProfiles: string;
  /** The restore default profiles description value. */
  readonly restoreDefaultProfilesDescription: string;
  /** The all profile data clear value. */
  readonly allProfileDataClear: string;
  /** The all profile data clear description value. */
  readonly allProfileDataClearDescription: string;
  /** The all profile data clear success value. */
  readonly allProfileDataClearSuccess: string;
  /** The application cache reset value. */
  readonly applicationCacheReset: string;
  /** The application cache reset description value. */
  readonly applicationCacheResetDescription: string;
  /** The application reset value. */
  readonly applicationReset: string;
  /** The application reset description value. */
  readonly applicationResetDescription: string;
  /** The graphics mode value. */
  readonly graphicsMode: string;
  /** The graphics mode description value. */
  readonly graphicsModeDescription: string;
  /** The graphics mode native value. */
  readonly graphicsModeNative: string;
  /** The graphics mode native description value. */
  readonly graphicsModeNativeDescription: string;
  /** The graphics mode compatible value. */
  readonly graphicsModeCompatible: string;
  /** The graphics mode compatible description value. */
  readonly graphicsModeCompatibleDescription: string;
  /** The graphics mode software value. */
  readonly graphicsModeSoftware: string;
  /** The graphics mode software description value. */
  readonly graphicsModeSoftwareDescription: string;
  /** The graphics restart title value. */
  readonly graphicsRestartTitle: string;
  /** The graphics restart description value. */
  readonly graphicsRestartDescription: string;
  /** The apply and restart value. */
  readonly applyAndRestart: string;
  /** The always on top value. */
  readonly alwaysOnTop: string;
  /** The always on top description value. */
  readonly alwaysOnTopDescription: string;
  /** The open menu on startup value. */
  readonly openMenuOnStartup: string;
  /** The open menu on startup description value. */
  readonly openMenuOnStartupDescription: string;
  /** The close menu on escape value. */
  readonly closeMenuOnEscape: string;
  /** The close menu on escape description value. */
  readonly closeMenuOnEscapeDescription: string;
  /** The close menu on outside click value. */
  readonly closeMenuOnOutsideClick: string;
  /** The close menu on outside click description value. */
  readonly closeMenuOnOutsideClickDescription: string;
  /** The menu order value. */
  readonly menuOrder: string;
  /** The menu order description value. */
  readonly menuOrderDescription: string;
  /** The edit menu order value. */
  readonly editMenuOrder: string;
  /** The menu order editor description value. */
  readonly menuOrderEditorDescription: string;
  /** The menu order categories value. */
  readonly menuOrderCategories: string;
  /** The menu order sites value. */
  readonly menuOrderSites: string;
  /** The drag to reorder value. */
  readonly dragToReorder: string;
  /** The reset menu order value. */
  readonly resetMenuOrder: string;
  /** The done value. */
  readonly done: string;
  /** The move up value. */
  readonly moveUp: string;
  /** The move down value. */
  readonly moveDown: string;
  /** The automatic updates value. */
  readonly automaticUpdates: string;
  /** The automatic updates description value. */
  readonly automaticUpdatesDescription: string;
  /** The default site value. */
  readonly defaultSite: string;
  /** The default site description value. */
  readonly defaultSiteDescription: string;
  /** The language value. */
  readonly language: string;
  /** The appearance value. */
  readonly appearance: string;
  /** The app theme value. */
  readonly appTheme: string;
  /** The app theme description value. */
  readonly appThemeDescription: string;
  /** The dark theme value. */
  readonly darkTheme: string;
  /** The light theme value. */
  readonly lightTheme: string;
  /** The app language value. */
  readonly appLanguage: string;
  /** The app language description value. */
  readonly appLanguageDescription: string;
  /** The global language description value. */
  readonly globalLanguageDescription: string;
  /** The plugin languages value. */
  readonly pluginLanguages: string;
  /** The site languages value. */
  readonly siteLanguages: string;
  /** The inherit value. */
  readonly inherit: string;
  /** The system value. */
  readonly system: string;
  /** The korean value. */
  readonly korean: string;
  /** The english value. */
  readonly english: string;
  /** The japanese value. */
  readonly japanese: string;
  /** The app shortcuts value. */
  readonly appShortcuts: string;
  /** The video value. */
  readonly video: string;
  /** The video settings description value. */
  readonly videoSettingsDescription: string;
  /** The video seek seconds value. */
  readonly videoSeekSeconds: string;
  /** The video seek seconds description value. */
  readonly videoSeekSecondsDescription: string;
  /** The video overlay hide seconds value. */
  readonly videoOverlayHideSeconds: string;
  /** The video overlay hide seconds description value. */
  readonly videoOverlayHideSecondsDescription: string;
  /** The video controls layout value. */
  readonly videoControlsLayout: string;
  /** The video controls inline value. */
  readonly videoControlsInline: string;
  /** The video controls inline description value. */
  readonly videoControlsInlineDescription: string;
  /** The video controls overlay value. */
  readonly videoControlsOverlay: string;
  /** The video controls overlay description value. */
  readonly videoControlsOverlayDescription: string;
  /** The seconds value. */
  readonly seconds: string;
  /** The log level value. */
  readonly logLevel: string;
  /** The log level description value. */
  readonly logLevelDescription: string;
  /** The log level error value. */
  readonly logLevelError: string;
  /** The log level error description value. */
  readonly logLevelErrorDescription: string;
  /** The log level warn value. */
  readonly logLevelWarn: string;
  /** The log level warn description value. */
  readonly logLevelWarnDescription: string;
  /** The log level info value. */
  readonly logLevelInfo: string;
  /** The log level info description value. */
  readonly logLevelInfoDescription: string;
  /** The log level verbose value. */
  readonly logLevelVerbose: string;
  /** The log level verbose description value. */
  readonly logLevelVerboseDescription: string;
  /** The log level debug value. */
  readonly logLevelDebug: string;
  /** The log level debug description value. */
  readonly logLevelDebugDescription: string;
  /** The log level none value. */
  readonly logLevelNone: string;
  /** The log level none description value. */
  readonly logLevelNoneDescription: string;
  /** The video shortcuts value. */
  readonly videoShortcuts: string;
  /** The video shortcuts description value. */
  readonly videoShortcutsDescription: string;
  /** The short form video shortcuts value. */
  readonly shortFormVideoShortcuts: string;
  /** The short form video shortcuts description value. */
  readonly shortFormVideoShortcutsDescription: string;
  /** The provider shortcuts value. */
  readonly providerShortcuts: string;
  /** The menu category shortcuts value. */
  readonly menuCategoryShortcuts: string;
  /** The menu category shortcuts description value. */
  readonly menuCategoryShortcutsDescription: string;
  /** The category position value. */
  readonly categoryPosition: string;
  /** The current category value. */
  readonly currentCategory: string;
  /** The site shortcuts value. */
  readonly siteShortcuts: string;
  /** The shortcut capture value. */
  readonly shortcutCapture: string;
  /** The shortcut names value. */
  readonly shortcutNames: Readonly<Record<string, string>>;
  /** The category labels value. */
  readonly categoryLabels: Readonly<Record<string, string>>;
  /** The disabled value. */
  readonly disabled: string;
  /** The empty value. */
  readonly empty: string;
  /** The duplicate shortcut value. */
  readonly duplicateShortcut: string;
  /** The reset value. */
  readonly reset: string;
  /** The default value value. */
  readonly defaultValue: string;
  /** The saved automatically value. */
  readonly savedAutomatically: string;
  /** The unsaved changes value. */
  readonly unsavedChanges: string;
  /** The save description value. */
  readonly saveDescription: string;
  /** The save changes value. */
  readonly saveChanges: string;
  /** The discard changes title value. */
  readonly discardChangesTitle: string;
  /** The discard changes description value. */
  readonly discardChangesDescription: string;
  /** The keep editing value. */
  readonly keepEditing: string;
  /** The discard and leave value. */
  readonly discardAndLeave: string;
  /** The shortcut conflict value. */
  readonly shortcutConflict: string;
  /** The shortcut conflict description value. */
  readonly shortcutConflictDescription: string;
  /** Whether the cancel option is enabled. */
  readonly cancel: string;
  /** The overwrite value. */
  readonly overwrite: string;
  /** The loading value. */
  readonly loading: string;
  /** The version value. */
  readonly version: string;
  /** The app description value. */
  readonly appDescription: string;
  /** The channel value. */
  readonly channel: string;
  /** The stable channel value. */
  readonly stableChannel: string;
  /** The staging channel value. */
  readonly stagingChannel: string;
  /** The nightly channel value. */
  readonly nightlyChannel: string;
  /** The check for updates value. */
  readonly checkForUpdates: string;
  /** The checking for updates value. */
  readonly checkingForUpdates: string;
  /** The latest version value. */
  readonly latestVersion: string;
  /** The update available value. */
  readonly updateAvailable: string;
  /** The update unavailable value. */
  readonly updateUnavailable: string;
  /** The update check failed value. */
  readonly updateCheckFailed: string;
  /** The runtime value. */
  readonly runtime: string;
  /** The platform value. */
  readonly platform: string;
  /** The diagnostic logs value. */
  readonly diagnosticLogs: string;
  /** The diagnostic logs description value. */
  readonly diagnosticLogsDescription: string;
  /** The open log directory value. */
  readonly openLogDirectory: string;
  /** The developer links value. */
  readonly developerLinks: string;
  /** The website value. */
  readonly website: string;
  /** The github value. */
  readonly github: string;
  /** The discord value. */
  readonly discord: string;
  /** The developer you tube value. */
  readonly developerYouTube: string;
  /** The live now value. */
  readonly liveNow: string;
  /** The offline value. */
  readonly offline: string;
  /** The live status unavailable value. */
  readonly liveStatusUnavailable: string;
  /** The checking live value. */
  readonly checkingLive: string;
  /** The installed plugins value. */
  readonly installedPlugins: string;
  /** The plugins value. */
  readonly plugins: string;
  /** The sites value. */
  readonly sites: string;
}

/** Describes the video messages contract. */
export interface VideoMessages {
  /** The welcome value. */
  readonly welcome: string;
  /** The change source value. */
  readonly changeSource: string;
  /** The source description value. */
  readonly sourceDescription: string;
  /** The open source value. */
  readonly openSource: string;
  /** The open folder value. */
  readonly openFolder: string;
  /** The open local value. */
  readonly openLocal: string;
  /** The YouTube download value. */
  readonly youtubeDownload: string;
  /** The hls URL value. */
  readonly hlsUrl: string;
  /** The play hls value. */
  readonly playHls: string;
  /** The invalid hls value. */
  readonly invalidHls: string;
  /** The shortcut hint value. */
  readonly shortcutHint: string;
  /** The loading value. */
  readonly loading: string;
  /** The play value. */
  readonly play: string;
  /** The pause value. */
  readonly pause: string;
  /** The controls value. */
  readonly controls: string;
  /** The timeline value. */
  readonly timeline: string;
  /** The volume value. */
  readonly volume: string;
  /** The live value. */
  readonly live: string;
  /** The go live value. */
  readonly goLive: string;
  /** The playback failed value. */
  readonly playbackFailed: string;
  /** The chromium playback failed value. */
  readonly chromiumPlaybackFailed: string;
  /** The runtime missing value. */
  readonly runtimeMissing: string;
  /** The chromium fallback value. */
  readonly chromiumFallback: string;
  /** The detecting backend value. */
  readonly detectingBackend: string;
  /** The intel mac fallback value. */
  readonly intelMacFallback: string;
  /** The native error fallback value. */
  readonly nativeErrorFallback: string;
  /** The native unavailable fallback value. */
  readonly nativeUnavailableFallback: string;
  /** The software rendering warning value. */
  readonly softwareRenderingWarning: string;
  /** The capture compatible rendering warning value. */
  readonly captureCompatibleRenderingWarning: string;
}

/** Describes the video browser messages contract. */
export interface VideoBrowserMessages {
  /** The library value. */
  readonly library: string;
  /** The computer value. */
  readonly computer: string;
  /** The description value. */
  readonly description: string;
  /** The drives value. */
  readonly drives: string;
  /** The favorites value. */
  readonly favorites: string;
  /** The Kawaikara favorites value. */
  readonly kawaikaraFavorites: string;
  /** The no Kawaikara favorites value. */
  readonly noKawaikaraFavorites: string;
  /** The add Kawaikara favorite value. */
  readonly addKawaikaraFavorite: string;
  /** The remove Kawaikara favorite value. */
  readonly removeKawaikaraFavorite: string;
  /** The favorite failed value. */
  readonly favoriteFailed: string;
  /** The no drives value. */
  readonly noDrives: string;
  /** The no favorites value. */
  readonly noFavorites: string;
  /** The folder value. */
  readonly folder: string;
  /** The home value. */
  readonly home: string;
  /** The up value. */
  readonly up: string;
  /** The address value. */
  readonly address: string;
  /** The address placeholder value. */
  readonly addressPlaceholder: string;
  /** The go value. */
  readonly go: string;
  /** The search value. */
  readonly search: string;
  /** The search placeholder value. */
  readonly searchPlaceholder: string;
  /** The empty folder value. */
  readonly emptyFolder: string;
  /** The empty description value. */
  readonly emptyDescription: string;
  /** The no search results value. */
  readonly noSearchResults: string;
  /** The no search description value. */
  readonly noSearchDescription: string;
  /** The select file value. */
  readonly selectFile: string;
  /** The select file description value. */
  readonly selectFileDescription: string;
  /** The path unavailable value. */
  readonly pathUnavailable: string;
  /** The folder unavailable value. */
  readonly folderUnavailable: string;
  /** The search failed value. */
  readonly searchFailed: string;
  /** The supported files value. */
  readonly supportedFiles: string;
  /** The hls value. */
  readonly hls: string;
  /** The close value. */
  readonly close: string;
}

/** Describes the video library messages contract. */
export interface VideoLibraryMessages {
  /** The eyebrow value. */
  readonly eyebrow: string;
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description: string;
  /** The folders value. */
  readonly folders: string;
  /** The videos value. */
  readonly videos: string;
  /** The no folders value. */
  readonly noFolders: string;
  /** The no folders help value. */
  readonly noFoldersHelp: string;
  /** The no videos value. */
  readonly noVideos: string;
  /** The no videos help value. */
  readonly noVideosHelp: string;
  /** The pinned value. */
  readonly pinned: string;
  /** The pin value. */
  readonly pin: string;
  /** The unpin value. */
  readonly unpin: string;
  /** The remove value. */
  readonly remove: string;
}

/** Describes the renderer messages contract. */
export interface RendererMessages {
  /** The locale value. */
  readonly locale: string;
  /** The app value. */
  readonly app: AppMessages;
  /** The video value. */
  readonly video: VideoMessages;
  /** The video browser value. */
  readonly videoBrowser: VideoBrowserMessages;
  /** The video library value. */
  readonly videoLibrary: VideoLibraryMessages;
}

/** Describes the renderer locale messages contract. */
interface RendererLocaleMessages {
  /** The app value. */
  readonly app: AppMessages;
  /** The video value. */
  readonly video: VideoMessages;
  /** The video browser value. */
  readonly videoBrowser: VideoBrowserMessages;
  /** The video library value. */
  readonly videoLibrary: VideoLibraryMessages;
}

/** Defines the shared locales constant. */
const LOCALES: Readonly<Record<'en' | 'ko' | 'ja', RendererLocaleMessages>> = {
  /** The en value. */
  en,
  /** The ko value. */
  ko,
  /** The ja value. */
  ja,
};

/** Returns the app messages. */
export function getAppMessages(
  locale: AppLocale,
  systemLocale: string,
): AppMessages {
  return LOCALES[toSupportedLanguage(resolveLocale(locale, systemLocale))].app;
}

/** Returns the renderer messages. */
export function getRendererMessages(
  locale: AppLocale,
  systemLocale: string,
): RendererMessages {
  const resolved = resolveLocale(locale, systemLocale);
  const messages = LOCALES[toSupportedLanguage(resolved)];
  return {
    /** The locale value. */
    locale: resolved,
    /** The app value. */
    app: messages.app,
    /** The video value. */
    video: messages.video,
    /** The video browser value. */
    videoBrowser: messages.videoBrowser,
    /** The video library value. */
    videoLibrary: messages.videoLibrary,
  };
}

/** Resolves the locale. */
function resolveLocale(locale: AppLocale, systemLocale: string): string {
  return locale === 'system' ? systemLocale : locale;
}

/** Performs the to supported language operation. */
function toSupportedLanguage(locale: string): keyof typeof LOCALES {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('ja')) return 'ja';
  return 'en';
}
