export { DisposableStore, type Disposable } from './Disposable';
export type { FileDropScope, ProviderFileDropDescriptor } from './DragDrop';
export {
    defineCapability,
    type CapabilityToken,
    type CapabilityRegistry,
    type PluginNetworkAPI,
    type PluginActionsAPI,
    type PluginSettingsAPI,
    type PluginLifetime,
    type PluginAppAPI,
    type PluginPageAPI,
    type PluginRuntimeState,
} from './PluginAPI';
export type {
    PictureInPictureSubtitleController,
    PictureInPictureSubtitleAlignment,
    PictureInPictureDomSubtitleOptions,
    ProviderPictureInPictureSession,
} from './PictureInPictureSubtitles';
export {
    createGitHubReleaseBundleUpdateResolver,
    type GitHubReleaseBundleUpdateOptions,
} from './BundleUpdates';
export {
    createExternalLoginFlow,
    type SiteExternalLoginFlow,
    type SiteExternalLoginFlowOptions,
} from './ExternalLoginFlow';
export {
    MEDIA_DOWNLOAD_CAPABILITY_ID,
    MEDIA_DOWNLOAD_CAPABILITY_VERSION,
    type MediaDownloadFailureCode,
    type MediaDownloadFeature,
    type MediaDownloadRequest,
    type MediaDownloadResource,
    type MediaDownloadResult,
} from './MediaDownloads';
export {
    getPluginMetadata,
    getProviderMetadata,
    plugin,
    provider,
} from './Decorators';
export {
    defineProviderLocale,
    type ProviderLocale,
    type ProviderLocaleResource,
} from './Locale';
export {
    AbstractPlugin,
    KAWAIKARA_MANIFEST_VERSION,
    KAWAIKARA_SITE_API_VERSION,
    defineBundle,
    definePlugin,
    defineProvider,
    isBundleDefinition,
    type BundleBrowserProfileDescriptor,
    type BundleDefinition,
    type BundleManifest,
    type BundleLocaleDescriptor,
    type BundleReleaseChannel,
    type BundleUpdateContext,
    type BundleUpdateDefinition,
    type BundleUpdateManifest,
    type BundleUpdateResolver,
    type PluginConstructor,
    type PluginContext,
    type PluginMetadata,
    type PluginDefinition,
    type PluginManifest,
    type ProviderDefinition,
    type ProviderManifest,
    type ProviderManifestDescriptors,
} from './Plugin';
export {
    AbstractProvider,
    AbstractUrlProvider,
    type ProviderConstructor,
    type ProviderDecoratorMetadata,
    type ProviderBooleanSettingDescriptor,
    type ProviderItemListSettingDescriptor,
    type ProviderLocalizedText,
    type PluginViewPanelContent,
    type PluginViewPanelDescriptor,
    type ProviderMetadata,
    type ProviderSettingCategoryDescriptor,
    type ProviderSettingDescriptor,
    type ProviderSettingListItem,
    type ProviderSettingValue,
    type ProviderSettingsDescriptor,
    type ProviderSettings,
    type SiteActionShortcutDescriptor,
    type SiteAddressDescriptor,
    type SiteMenuDescriptor,
    type SiteLocaleDescriptor,
    type SiteIsolationDescriptor,
    type SitePermission,
    type SitePictureInPictureDescriptor,
    type SiteRequestDetails,
    type SiteRequestHeaders,
    type SiteRequestRedirect,
    type SiteShortcutDescriptor,
} from './Provider';
export {
    SHORT_FORM_VIDEO_ACTIONS,
    SHORT_FORM_PUBLISHER_CAPABILITY,
    SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING,
    SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING,
    normalizeShortFormVideoPublisher,
    readShortFormVideoAutoAdvance,
    readShortFormVideoBannedPublishers,
    resolveShortFormVideoCommand,
    type ShortFormVideoDescriptor,
    type ShortFormVideoAction,
    type ShortFormVideoCommand,
    type ShortFormVideoPublisher,
} from './ShortFormVideo';
export {
    type ExternalLoginOptions,
    type ExternalLoginResult,
    type NewWindowPolicy,
    type SiteActions,
    type SiteBrowser,
    type SiteBrowserIdentityOptions,
    type SiteCookieClearOptions,
    type SiteCookieMetadata,
    type SiteCookieQuery,
    type SiteCookieStore,
    type SiteContext,
    type SiteExternalBrowser,
    type SiteLogger,
    type SiteLocaleContext,
    type SitePageFrameScope,
    type SitePageInjection,
    type SitePagePhase,
    type SitePagePipeline,
    type SiteViewer,
} from './SiteContext';
export {
    createChromiumClientHints,
    createChromiumUserAgent,
    createLoginControlInjection,
    isSiteLoginNavigation,
    matchesSiteUrlHost,
    resolveLocaleVariant,
    serializePageInjection,
    serializePageInjectionWithOptions,
    setRequestHeader,
    webAuthenticationPolicy,
    webPopupPolicy,
    type SiteLoginControlInjectionOptions,
} from './SiteUtilities';
export * from './VideoEffects';

/** Deprecated type aliases for existing Bundle sources. */
export type { ProviderFileDropContribution } from './DragDrop';

/** Deprecated type aliases for existing Bundle sources. */
export type {
    BundleLocaleContribution,
    BundleBrowserProfileContribution,
    ProviderManifestPictureInPictureContribution,
    ProviderManifestContributions,
} from './Plugin';

/** Deprecated type aliases for existing Bundle sources. */
export type {
    SiteMenuContribution,
    PluginViewPanelContribution,
    SiteShortcutContribution,
    SiteActionShortcutContribution,
    ProviderBooleanSettingContribution,
    ProviderItemListSettingContribution,
    ProviderSelectSettingContribution,
    ProviderSettingContribution,
    ProviderSettingCategoryContribution,
    ProviderSettingsContribution,
    SiteLocaleContribution,
    SiteIsolationContribution,
    SitePictureInPictureContribution,
    SiteAddressContribution,
} from './Provider';

/** Deprecated type aliases for existing Bundle sources. */
export type { ShortFormVideoContribution } from './ShortFormVideo';

/** Deprecated type aliases for existing Bundle sources. */
export type { VideoEffectContribution } from './VideoEffects';
