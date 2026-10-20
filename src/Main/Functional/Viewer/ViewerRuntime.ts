import { WindowManager } from '../../Manager/WindowManager';
import { ProviderSiteHost } from '../Bundle/Provider/ProviderSiteHost';
import { VideoController } from '../Video/VideoController';
import { ViewerPictureInPicture } from './ViewerPictureInPicture';
import { ViewerInput } from './ViewerInput';
import { ViewerDiagnostics } from './ViewerDiagnostics';
import { ViewerLifecycle } from './ViewerLifecycle';
import { ViewerController } from './ViewerController';
import type { ExternalBrowserManager } from '../../Manager/ExternalBrowserManager';
import type { LoggingManager } from '../../Manager/LoggingManager';
import type { PictureInPictureManagerFactory } from '../Window/WindowRuntime';
/** Explicit feature owners, assembled once at application startup. */
export interface ViewerRuntime {
    /** WindowManager owner. */
    readonly windows: WindowManager;
    /** ProviderSiteHost owner. */
    readonly site: ProviderSiteHost;
    /** VideoController owner. */
    readonly video: VideoController;
    /** ViewerPictureInPicture owner. */
    readonly pip: ViewerPictureInPicture;
    /** ViewerInput owner. */
    readonly input: ViewerInput;
    /** ViewerDiagnostics owner. */
    readonly diagnostics: ViewerDiagnostics;
    /** ViewerLifecycle owner. */
    readonly lifecycle: ViewerLifecycle;
    /** ViewerController owner. */
    readonly viewer: ViewerController;
}
/**
 * Constructs feature owners and connects their narrow capabilities for one application runtime.
 *
 * @param externalBrowser - Application-owned external-login/browser service shared by site hosting.
 * @param createPictureInPicture - Factory for the existing Provider PiP implementation.
 * @param logging - Application logging service used by native and renderer owners.
 * @returns Named window, presentation, site, video, PiP, input, diagnostics and lifecycle owners.
 * @remarks Does not open the main viewer window; startup calls viewer.createWindows()
 * after applying preferences. Call lifecycle.beginViewerShutdown() before asynchronous
 * application teardown and await lifecycle.dispose() to release viewer resources.
 * The caller retains ownership of the supplied application services.
 */
export function createViewerRuntime(
    externalBrowser: ExternalBrowserManager,
    createPictureInPicture: PictureInPictureManagerFactory,
    logging: LoggingManager,
): ViewerRuntime {
    let windows: WindowManager;
    let site: ProviderSiteHost;
    let video: VideoController;
    let pip: ViewerPictureInPicture;
    let input: ViewerInput;
    let diagnostics: ViewerDiagnostics;
    let lifecycle: ViewerLifecycle;
    let viewer: ViewerController;
    windows = new WindowManager(logging);
    site = new ProviderSiteHost(
        {
            get pictureInPictureGuard() {
                return pip.pictureInPictureGuard;
            },
            set pictureInPictureGuard(value) {
                pip.pictureInPictureGuard = value;
            },
            get pictureInPictureContentOverlaySelectors() {
                return pip.pictureInPictureContentOverlaySelectors;
            },
            set pictureInPictureContentOverlaySelectors(value) {
                pip.pictureInPictureContentOverlaySelectors = value;
            },
            get pictureInPicture() {
                return pip.pictureInPicture;
            },
            requireActiveViewerWebContents: (...args) =>
                viewer.requireActiveViewerWebContents(...args),
            get internalVideoVisible() {
                return viewer.internalVideoVisible;
            },
            assertViewerRequestsAccepted: (...args) =>
                lifecycle.assertViewerRequestsAccepted(...args),
            requireViewerWindow: (...args) =>
                windows.requireViewerWindow(...args),
            prepareForSiteActivation: (...args) =>
                viewer.prepareForSiteActivation(...args),
            getViewerSurfaceColor: (...args) =>
                viewer.getViewerSurfaceColor(...args),
            syncOverlayBounds: (...args) => viewer.syncOverlayBounds(...args),
            get logViewer() {
                return diagnostics.logViewer;
            },
            focusUnderlyingLogViewer: (...args) =>
                viewer.focusUnderlyingLogViewer(...args),
            connectWindowInput: (...args) => input.connectWindowInput(...args),
            areViewerRequestsAccepted: (...args) =>
                lifecycle.areViewerRequestsAccepted(...args),
            get viewerWindow() {
                return windows.viewerWindow;
            },
            revealActiveSiteView: (...args) =>
                viewer.revealActiveSiteView(...args),
            exitPictureInPictureForTransition: (...args) =>
                pip.exitPictureInPictureForTransition(...args),
            get editingWebContentsIds() {
                return input.editingWebContentsIds;
            },
            get appTitle() {
                return viewer.appTitle;
            },
            get keepSiteDevToolsOpen() {
                return diagnostics.keepSiteDevToolsOpen;
            },
            set keepSiteDevToolsOpen(value) {
                diagnostics.keepSiteDevToolsOpen = value;
            },
            configureDevToolsWebContents: (...args) =>
                diagnostics.configureDevToolsWebContents(...args),
            get openDevToolsOnInitialSite() {
                return diagnostics.openDevToolsOnInitialSite;
            },
            set openDevToolsOnInitialSite(value) {
                diagnostics.openDevToolsOnInitialSite = value;
            },
            openActiveSiteDevTools: (...args) =>
                diagnostics.openActiveSiteDevTools(...args),
            get devToolsMode() {
                return diagnostics.devToolsMode;
            },
            get detachedDevToolsBounds() {
                return diagnostics.detachedDevToolsBounds;
            },
            set detachedDevToolsBounds(value) {
                diagnostics.detachedDevToolsBounds = value;
            },
            get currentVideoOpenRequest() {
                return video.currentVideoOpenRequest;
            },
            set currentVideoOpenRequest(value) {
                video.currentVideoOpenRequest = value;
            },
            presentInternalVideo: (...args) =>
                video.presentInternalVideo(...args),
            get appLocale() {
                return viewer.appLocale;
            },
            get systemLocale() {
                return viewer.systemLocale;
            },
            get appTheme() {
                return viewer.appTheme;
            },
        },
        logging,
        externalBrowser,
    );
    video = new VideoController(
        {
            get internalVideoPictureInPicture() {
                return pip.internalVideoPictureInPicture;
            },
            get isPictureInPictureTransitionPending() {
                return pip.isPictureInPictureTransitionPending;
            },
            get appLocale() {
                return viewer.appLocale;
            },
            get systemLocale() {
                return viewer.systemLocale;
            },
            requireViewerWindow: (...args) =>
                windows.requireViewerWindow(...args),
            assertViewerRequestsAccepted: (...args) =>
                lifecycle.assertViewerRequestsAccepted(...args),
            get internalVideoVisible() {
                return viewer.internalVideoVisible;
            },
            set internalVideoVisible(value) {
                viewer.internalVideoVisible = value;
            },
            get disposing() {
                return lifecycle.disposing;
            },
            get viewerWindow() {
                return windows.viewerWindow;
            },
            get overlayVisible() {
                return viewer.overlayVisible;
            },
            connectWindowInput: (...args) => input.connectWindowInput(...args),
            get editingWebContentsIds() {
                return input.editingWebContentsIds;
            },
            get logViewer() {
                return diagnostics.logViewer;
            },
            syncOverlayBounds: (...args) => viewer.syncOverlayBounds(...args),
            requireSiteView: (...args) => site.requireSiteView(...args),
            get siteViewAttached() {
                return site.siteViewAttached;
            },
            set siteViewAttached(value) {
                site.siteViewAttached = value;
            },
            focusUnderlyingLogViewer: (...args) =>
                viewer.focusUnderlyingLogViewer(...args),
        },
        logging,
    );
    pip = new ViewerPictureInPicture(
        {
            requireViewerWindow: (...args) =>
                windows.requireViewerWindow(...args),
            requireSiteView: (...args) => site.requireSiteView(...args),
            get overlaySurface() {
                return viewer.overlaySurface;
            },
            get viewerWindow() {
                return windows.viewerWindow;
            },
            get disposing() {
                return lifecycle.disposing;
            },
            focusViewer: (...args) => viewer.focusViewer(...args),
            restoreOverlayAfterPictureInPicture: (...args) =>
                viewer.restoreOverlayAfterPictureInPicture(...args),
            get appLocale() {
                return viewer.appLocale;
            },
            setPresentationSuppressed: (...args) =>
                windows.setPresentationSuppressed(...args),
            assertViewerRequestsAccepted: (...args) =>
                lifecycle.assertViewerRequestsAccepted(...args),
            get internalVideoVisible() {
                return viewer.internalVideoVisible;
            },
            requireSiteWebContents: (...args) =>
                site.requireSiteWebContents(...args),
            prepareOverlayForPictureInPicture: (...args) =>
                viewer.prepareOverlayForPictureInPicture(...args),
            get internalVideoPresentation() {
                return video.internalVideoPresentation;
            },
            requireVideoView: (...args) => video.requireVideoView(...args),
            get systemLocale() {
                return viewer.systemLocale;
            },
            syncVideoViewBounds: (...args) =>
                video.syncVideoViewBounds(...args),
            get videoView() {
                return video.videoView;
            },
            syncOverlayBounds: (...args) => viewer.syncOverlayBounds(...args),
        },
        logging,
        createPictureInPicture,
    );
    input = new ViewerInput(
        {
            get siteView() {
                return site.siteView;
            },
            get videoView() {
                return video.videoView;
            },
            get overlaySurface() {
                return viewer.overlaySurface;
            },
            toggleOverlay: (...args) => viewer.toggleOverlay(...args),
            areViewerRequestsAccepted: (...args) =>
                lifecycle.areViewerRequestsAccepted(...args),
            get overlayVisible() {
                return viewer.overlayVisible;
            },
            get overlayView() {
                return viewer.overlayView;
            },
            get closeMenuOnEscape() {
                return viewer.closeMenuOnEscape;
            },
            get internalVideoVisible() {
                return viewer.internalVideoVisible;
            },
            get internalVideoPictureInPicture() {
                return pip.internalVideoPictureInPicture;
            },
        },
        logging,
    );
    diagnostics = new ViewerDiagnostics(
        {
            get viewerWindow() {
                return windows.viewerWindow;
            },
            focusUnderlyingLogViewer: (...args) =>
                viewer.focusUnderlyingLogViewer(...args),
            get appTheme() {
                return viewer.appTheme;
            },
            get appLocale() {
                return viewer.appLocale;
            },
            get overlaySurface() {
                return viewer.overlaySurface;
            },
            getActiveViewerWebContents: (...args) =>
                viewer.getActiveViewerWebContents(...args),
            connectWindowInput: (...args) => input.connectWindowInput(...args),
        },
        logging,
    );
    lifecycle = new ViewerLifecycle(
        {
            recordAppWindowPosition: (...args) =>
                windows.recordAppWindowPosition(...args),
            get logViewer() {
                return diagnostics.logViewer;
            },
            stopExternalFullscreenMonitoring: (...args) =>
                windows.stopExternalFullscreenMonitoring(...args),
            stopVideoInitialization: (...args) =>
                video.stopVideoInitialization(...args),
            exitPictureInPictureForTransition: (...args) =>
                pip.exitPictureInPictureForTransition(...args),
            cancelExternalLogin: (...args) => site.cancelExternalLogin(...args),
            closeSitePopups: (...args) => site.closeSitePopups(...args),
            get newWindowPolicyResolver() {
                return site.newWindowPolicyResolver;
            },
            set newWindowPolicyResolver(value) {
                site.newWindowPolicyResolver = value;
            },
            get siteActionHandler() {
                return site.siteActionHandler;
            },
            set siteActionHandler(value) {
                site.siteActionHandler = value;
            },
            get navigationGuard() {
                return site.navigationGuard;
            },
            set navigationGuard(value) {
                site.navigationGuard = value;
            },
            get pictureInPictureGuard() {
                return pip.pictureInPictureGuard;
            },
            set pictureInPictureGuard(value) {
                pip.pictureInPictureGuard = value;
            },
            get pictureInPictureContentOverlaySelectors() {
                return pip.pictureInPictureContentOverlaySelectors;
            },
            set pictureInPictureContentOverlaySelectors(value) {
                pip.pictureInPictureContentOverlaySelectors = value;
            },
            get pictureInPicture() {
                return pip.pictureInPicture;
            },
            get pictureInPictureStateHandler() {
                return pip.pictureInPictureStateHandler;
            },
            set pictureInPictureStateHandler(value) {
                pip.pictureInPictureStateHandler = value;
            },
            get requestTransformer() {
                return site.requestTransformer;
            },
            set requestTransformer(value) {
                site.requestTransformer = value;
            },
            get requestHeadersTransformer() {
                return site.requestHeadersTransformer;
            },
            set requestHeadersTransformer(value) {
                site.requestHeadersTransformer = value;
            },
            get shortcutHandler() {
                return input.shortcutHandler;
            },
            set shortcutHandler(value) {
                input.shortcutHandler = value;
            },
            destroySiteView: (...args) => site.destroySiteView(...args),
            disposeVideoPlayback: (...args) =>
                video.disposeVideoPlayback(...args),
            get viewerWindow() {
                return windows.viewerWindow;
            },
            get siteView() {
                return site.siteView;
            },
            get videoView() {
                return video.videoView;
            },
            set videoView(value) {
                video.videoView = value;
            },
            releaseVideoForUpdate: (...args) =>
                video.releaseVideoForUpdate(...args),
            recoverVideoAfterFailedUpdate: (...args) =>
                video.recoverVideoAfterFailedUpdate(...args),
            get internalVideoPictureInPicture() {
                return pip.internalVideoPictureInPicture;
            },
            clearInternalVideoPictureInPictureReassertions: (...args) =>
                pip.clearInternalVideoPictureInPictureReassertions(...args),
            clearInternalVideoPictureInPicturePointerMonitor: (...args) =>
                pip.clearInternalVideoPictureInPicturePointerMonitor(...args),
            clearOverlayRevealTimer: (...args) =>
                viewer.clearOverlayRevealTimer(...args),
            get editingWebContentsIds() {
                return input.editingWebContentsIds;
            },
            releaseNativeWindow: (...args) =>
                windows.releaseNativeWindow(...args),
            get overlaySurface() {
                return viewer.overlaySurface;
            },
            set overlaySurface(value) {
                viewer.overlaySurface = value;
            },
            get overlayVisible() {
                return viewer.overlayVisible;
            },
            set overlayVisible(value) {
                viewer.overlayVisible = value;
            },
        },
        logging,
    );
    viewer = new ViewerController(
        {
            get viewerWindow() {
                return windows.viewerWindow;
            },
            createNativeWindow: (...args) =>
                windows.createNativeWindow(...args),
            get disposing() {
                return lifecycle.disposing;
            },
            set disposing(value) {
                lifecycle.disposing = value;
            },
            get viewerClosePrepared() {
                return lifecycle.viewerClosePrepared;
            },
            set viewerClosePrepared(value) {
                lifecycle.viewerClosePrepared = value;
            },
            syncSiteViewBounds: (...args) => site.syncSiteViewBounds(...args),
            syncVideoViewBounds: (...args) =>
                video.syncVideoViewBounds(...args),
            refreshExternalFullscreenState: (...args) =>
                windows.refreshExternalFullscreenState(...args),
            get videoView() {
                return video.videoView;
            },
            get logViewer() {
                return diagnostics.logViewer;
            },
            focusInternalVideoView: (...args) =>
                video.focusInternalVideoView(...args),
            navigateVideoDirectory: (...args) =>
                video.navigateVideoDirectory(...args),
            get viewerClosePreparation() {
                return lifecycle.viewerClosePreparation;
            },
            set viewerClosePreparation(value) {
                lifecycle.viewerClosePreparation = value;
            },
            prepareViewerWindowClose: (...args) =>
                lifecycle.prepareViewerWindowClose(...args),
            handleViewerClosed: (...args) =>
                lifecycle.handleViewerClosed(...args),
            connectWindowInput: (...args) => input.connectWindowInput(...args),
            get editingWebContentsIds() {
                return input.editingWebContentsIds;
            },
            requireViewerWindow: (...args) =>
                windows.requireViewerWindow(...args),
            get siteView() {
                return site.siteView;
            },
            get siteViewAttached() {
                return site.siteViewAttached;
            },
            get siteViewSiteId() {
                return site.siteViewSiteId;
            },
            get internalVideoPictureInPicture() {
                return pip.internalVideoPictureInPicture;
            },
            exitPictureInPictureForTransition: (...args) =>
                pip.exitPictureInPictureForTransition(...args),
            get internalVideoPresentation() {
                return video.internalVideoPresentation;
            },
            set internalVideoPresentation(value) {
                video.internalVideoPresentation = value;
            },
            setInternalVideoSiteVisibility: (...args) =>
                video.setInternalVideoSiteVisibility(...args),
        },
        logging,
    );
    return {
        /** windows owner. */
        windows,
        /** site owner. */
        site,
        /** video owner. */
        video,
        /** pip owner. */
        pip,
        /** input owner. */
        input,
        /** diagnostics owner. */
        diagnostics,
        /** lifecycle owner. */
        lifecycle,
        /** viewer owner. */
        viewer,
    };
}
