import type {
    Disposable,
    NewWindowPolicy,
    PictureInPictureSubtitleController,
    ProviderPictureInPictureSession,
    SiteBrowserIdentityOptions,
    SiteContext,
    SiteExternalBrowser,
    SiteLogger,
    SiteRequestDetails,
    SiteRequestHeaders,
    SiteRequestRedirect,
    SiteViewer,
} from '@kawaikara/site-api';
import {
    createChromiumClientHints,
    createChromiumUserAgent,
    matchesSiteUrlHost,
    setRequestHeader,
} from '@kawaikara/site-api';
import {
    BrowserWindow,
    session,
    WebContentsView,
    type Session,
    type WebContents,
} from 'electron';
import path from 'node:path';
import {
    type AppLocale,
    type AppTheme,
    type DevToolsMode,
    type SiteNavigationState,
    type VideoOpenRequest,
} from '../../../../Common/IPC';
import { createSitePagePipeline } from './SitePagePipeline';
import type { SiteRuntimeProfile } from './SiteRuntime';
import { getExternalLoginViewData } from '../../Localization/Locale';
import { createVideoEffectsHost } from '../../Video/VideoEffectsHost';
import { DetachableWindowSurface } from '../../Window/DetachableWindowSurface';
import { bindSiteSurfaceEvents } from '../../Window/SiteSurfaceEvents';
import { type WindowInputSurface } from '../../Window/WindowInput';
import {
    createSiteCookieStore,
    loadURLWithNavigationRecovery,
    prepareCurrentDocumentForNavigation,
} from '../../Window/WindowOperations';
import {
    attachWindowSurface,
    detachWindowSurface,
} from '../../Window/WindowSurfaceHost';
import { createRemoteThemeBridgeInjectionScript } from '../../../Inject/RemoteTheme';
import { openInDefaultBrowser } from '../../../Platform/DefaultBrowser';
import { ExternalBrowserManager } from '../../../Manager/ExternalBrowserManager';
import type { LoggingManager } from '../../../Manager/LoggingManager';
import { UnifiedPictureInPictureManager } from '../../../Manager/UnifiedPictureInPictureManager';
/** Capabilities used by ProviderSiteHost; values are resolved from their owner at dispatch time. */
export interface ProviderSiteHostHost {
    /** Reads pictureInPictureGuard from its owner. */
    pictureInPictureGuard: ((url: string) => boolean) | undefined;
    /** Reads pictureInPictureContentOverlaySelectors from its owner. */
    pictureInPictureContentOverlaySelectors:
        (() => readonly string[]) | undefined;
    /** Reads pictureInPicture from its owner. */
    readonly pictureInPicture: UnifiedPictureInPictureManager;
    /** Requests requireActiveViewerWebContents from its owner. */
    readonly requireActiveViewerWebContents: () => WebContents;
    /** Reads internalVideoVisible from its owner. */
    readonly internalVideoVisible: boolean;
    /** Requests assertViewerRequestsAccepted from its owner. */
    readonly assertViewerRequestsAccepted: () => void;
    /** Requests requireViewerWindow from its owner. */
    readonly requireViewerWindow: () => BrowserWindow;
    /** Requests prepareForSiteActivation from its owner. */
    readonly prepareForSiteActivation: () => Promise<void>;
    /** Requests getViewerSurfaceColor from its owner. */
    readonly getViewerSurfaceColor: () => string;
    /** Requests syncOverlayBounds from its owner. */
    readonly syncOverlayBounds: () => void;
    /** Reads logViewer from its owner. */
    readonly logViewer: DetachableWindowSurface;
    /** Requests focusUnderlyingLogViewer from its owner. */
    readonly focusUnderlyingLogViewer: () => void;
    /** Requests connectWindowInput from its owner. */
    readonly connectWindowInput: (
        contents: WebContents,
        surface: WindowInputSurface,
    ) => () => void;
    /** Requests areViewerRequestsAccepted from its owner. */
    readonly areViewerRequestsAccepted: () => boolean;
    /** Reads viewerWindow from its owner. */
    readonly viewerWindow: BrowserWindow | undefined;
    /** Requests revealActiveSiteView from its owner. */
    readonly revealActiveSiteView: (
        contents: WebContents,
        reason: string,
    ) => void;
    /** Requests exitPictureInPictureForTransition from its owner. */
    readonly exitPictureInPictureForTransition: (
        notify?: boolean,
    ) => Promise<void>;
    /** Reads editingWebContentsIds from its owner. */
    readonly editingWebContentsIds: Set<number>;
    /** Reads appTitle from its owner. */
    readonly appTitle: string;
    /** Reads keepSiteDevToolsOpen from its owner. */
    keepSiteDevToolsOpen: boolean;
    /** Requests configureDevToolsWebContents from its owner. */
    readonly configureDevToolsWebContents: (
        inspectedContents: WebContents,
        windowLookupAttempt?: number,
    ) => void;
    /** Reads openDevToolsOnInitialSite from its owner. */
    openDevToolsOnInitialSite: boolean;
    /** Requests openActiveSiteDevTools from its owner. */
    readonly openActiveSiteDevTools: (activate: boolean) => void;
    /** Reads devToolsMode from its owner. */
    readonly devToolsMode: DevToolsMode;
    /** Reads detachedDevToolsBounds from its owner. */
    detachedDevToolsBounds: Electron.Rectangle | undefined;
    /** Reads currentVideoOpenRequest from its owner. */
    currentVideoOpenRequest: VideoOpenRequest | null;
    /** Requests presentInternalVideo from its owner. */
    readonly presentInternalVideo: () => Promise<void>;
    /** Reads appLocale from its owner. */
    readonly appLocale: AppLocale;
    /** Reads systemLocale from its owner. */
    readonly systemLocale: string;
    /** Reads appTheme from its owner. */
    readonly appTheme: AppTheme;
}

/** Owns site state and lifecycle independently of application composition. */
export class ProviderSiteHost {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Cross-feature capabilities. */ private readonly host: ProviderSiteHostHost,
        /** Renderer logging service. */ private readonly logging: LoggingManager,
        externalBrowser: ExternalBrowserManager,
    ) {
        this.logger = logging.getLogger('windowManager');
        this.externalBrowser = externalBrowser;
    }

    /** The external browser value. */
    readonly externalBrowser: ExternalBrowserManager;

    /** The site popup Windows value. */
    readonly sitePopupWindows = new Set<BrowserWindow>();

    /** The site view value. */
    siteView?: WebContentsView;

    /** Provider identity associated with the currently attached native view. */
    siteViewSiteId?: string;

    /** The site view attached value. */
    siteViewAttached = false;

    /** The configured site sessions value. */
    readonly configuredSiteSessions = new WeakSet<Session>();

    /** Reject late requests from retired views without excluding a popup's first request. */
    readonly retiredSiteWebContentsIds = new Set<number>();

    /** The external login generation value. */
    externalLoginGeneration = 0;

    /** Callback used to handle new window policy resolver. */
    newWindowPolicyResolver?: (url: string) => NewWindowPolicy;

    /** Callback used to handle site action handler. */
    siteActionHandler?: (action: string) => Promise<boolean>;

    /** Callback used to handle navigation guard. */
    navigationGuard?: (url: string) => boolean;

    /** Callback used to handle request headers transformer. */
    requestHeadersTransformer?: (
        details: SiteRequestDetails,
    ) => SiteRequestHeaders | undefined;

    /** Callback used to handle request transformer. */
    requestTransformer?: (
        details: SiteRequestDetails,
    ) => SiteRequestRedirect | undefined;

    /** The site browser identity value. */
    siteBrowserIdentity?: {
        /** The user agent value. */
        readonly userAgent: string;
        /** The request hosts value. */
        readonly requestHosts?: readonly string[];
        /** The client hints value. */
        readonly clientHints?: string;
    };

    /** Sets the site handlers. */
    setSiteHandlers(handlers: {
        /** Resolves the new window policy. */
        resolveNewWindowPolicy(url: string): NewWindowPolicy;
        /** Handles the action. */
        handleAction(action: string): Promise<boolean>;
        /** Performs the allow navigation operation. */
        allowNavigation(url: string): boolean;
        /** Performs the allow picture in picture operation. */
        allowPictureInPicture(url: string): boolean;
        /** Returns the picture in picture content overlay selectors. */
        getPictureInPictureContentOverlaySelectors(): readonly string[];
        /** Create a frame-scoped Provider subtitle adapter. */
        createPictureInPictureSubtitleController(
            session: ProviderPictureInPictureSession,
        ):
            | PictureInPictureSubtitleController
            | undefined
            | Promise<PictureInPictureSubtitleController | undefined>;
        /** Performs the transform request operation. */
        transformRequest(
            details: SiteRequestDetails,
        ): SiteRequestRedirect | undefined;
        /** Performs the transform request headers operation. */
        transformRequestHeaders(
            details: SiteRequestDetails,
        ): SiteRequestHeaders | undefined;
    }): void {
        this.newWindowPolicyResolver = handlers.resolveNewWindowPolicy;
        this.siteActionHandler = handlers.handleAction;
        this.navigationGuard = handlers.allowNavigation;
        this.host.pictureInPictureGuard = handlers.allowPictureInPicture;
        this.host.pictureInPictureContentOverlaySelectors =
            handlers.getPictureInPictureContentOverlaySelectors;
        this.host.pictureInPicture.setSubtitleControllerFactory((session) =>
            handlers.createPictureInPictureSubtitleController(session),
        );
        this.requestTransformer = handlers.transformRequest;
        this.requestHeadersTransformer = handlers.transformRequestHeaders;
    }

    /** Returns the current site address. */
    getCurrentSiteAddress(): string {
        const webContents = this.siteView?.webContents;
        if (!webContents || webContents.isDestroyed()) return '';
        const value = webContents.getURL();
        try {
            return new URL(value).protocol === 'https:' ? value : '';
        } catch {
            return '';
        }
    }

    /** Performs the dispatch site action operation. */
    dispatchSiteAction(action: string): void {
        const handler = this.siteActionHandler;
        if (!handler) {
            this.logger.warn(
                `No site action handler is registered for: ${action}`,
            );
            return;
        }

        void handler(action)
            .then((handled) => {
                if (!handled) {
                    this.logger.warn(
                        `The current site did not handle action: ${action}`,
                    );
                }
            })
            .catch((error: unknown) => {
                this.logger.error(`Site action failed: ${action}`, error);
            });
    }

    /** Creates the site context. */
    async createSiteContext(
        runtime: SiteRuntimeProfile,
        permissions: ReadonlySet<string>,
    ): Promise<SiteContext> {
        const { siteSession, webContents } =
            await this.activateSiteView(runtime);
        this.requireCurrentSiteContext(webContents);
        const viewer = this.createSiteViewer(webContents, permissions);
        this.siteBrowserIdentity = undefined;
        const logger: SiteLogger = {
            debug: (message, ...args) => this.logger.debug(message, ...args),
            info: (message, ...args) => this.logger.info(message, ...args),
            warn: (message, ...args) => this.logger.warn(message, ...args),
            error: (message, ...args) => this.logger.error(message, ...args),
        };
        const externalBrowser: SiteExternalBrowser = {
            login: (options) => {
                this.requireCurrentSiteContext(webContents);
                if (!permissions.has('external-browser')) {
                    throw new Error(
                        'This Provider does not have the external-browser permission.',
                    );
                }
                return this.runExternalLogin(
                    options,
                    webContents,
                    siteSession,
                    viewer,
                );
            },
            close: () =>
                permissions.has('external-browser') &&
                this.siteView?.webContents === webContents
                    ? this.cancelExternalLogin()
                    : Promise.resolve(),
        };
        const page = createSitePagePipeline(webContents, logger);
        return {
            /** The video effects value. */
            videoEffects: permissions.has('script-injection')
                ? createVideoEffectsHost(webContents, page, logger)
                : undefined,
            /** The viewer value. */
            viewer,
            // ProviderManager keeps this core pipeline for application-owned policies
            // and removes it from the Provider view when permission is not granted.
            /** The page value. */
            page,
            /** The browser value. */
            browser: permissions.has('network-interception')
                ? {
                      /** The use identity value. */
                      useIdentity: (options) =>
                          this.useSiteBrowserIdentity(webContents, options),
                  }
                : undefined,
            /** The actions value. */
            actions: {
                /** The create URL value. */
                createUrl: (action) => {
                    if (!permissions.has('script-injection')) {
                        throw new Error(
                            'Site action URLs require script-injection permission.',
                        );
                    }
                    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(action)) {
                        throw new Error(`Invalid site action: ${action}`);
                    }
                    return `kawaikara-action://invoke/${encodeURIComponent(action)}`;
                },
            },
            /** The external browser value. */
            externalBrowser,
            /** The cookies value. */
            cookies: permissions.has('cookies')
                ? createSiteCookieStore(siteSession, () =>
                      this.requireCurrentSiteContext(webContents),
                  )
                : undefined,
            /** The logger value. */
            logger,
            /** The open external value. */
            openExternal: (url) => {
                this.requireCurrentSiteContext(webContents);
                if (!permissions.has('navigation')) {
                    throw new Error(
                        'Opening an external URL requires navigation permission.',
                    );
                }
                return openInDefaultBrowser(url);
            },
        };
    }

    /** Performs the go back operation. */
    goBack(): boolean {
        const navigation =
            this.host.requireActiveViewerWebContents().navigationHistory;
        if (!this.canNavigateHistory(-1)) return false;
        navigation.goToOffset(-1);
        return true;
    }

    /** Performs the go forward operation. */
    goForward(): boolean {
        const navigation =
            this.host.requireActiveViewerWebContents().navigationHistory;
        if (!this.canNavigateHistory(1)) return false;
        navigation.goToOffset(1);
        return true;
    }

    /** Returns the active site's bounded navigation state. */
    getNavigationState(): SiteNavigationState {
        return {
            /** Whether the can go back option is enabled. */
            canGoBack: this.canNavigateHistory(-1),
            /** Whether the can go forward option is enabled. */
            canGoForward: this.canNavigateHistory(1),
        };
    }

    /** Determines whether a history offset remains inside the active site. */
    canNavigateHistory(offset: -1 | 1): boolean {
        if (this.host.internalVideoVisible) return false;
        const contents = this.siteView?.webContents;
        if (!contents || contents.isDestroyed()) return false;
        const navigation = contents.navigationHistory;
        if (!navigation.canGoToOffset(offset)) return false;
        const entry = navigation.getEntryAtIndex(
            navigation.getActiveIndex() + offset,
        );
        if (!entry || !isUserNavigableHistoryUrl(entry.url)) return false;
        return this.navigationGuard?.(entry.url) === true;
    }

    /** Performs the activate site view operation. */
    async activateSiteView(runtime: SiteRuntimeProfile): Promise<{
        /** The site session value. */
        readonly siteSession: Session;
        /** The web contents value. */
        readonly webContents: WebContents;
    }> {
        this.host.assertViewerRequestsAccepted();
        const viewerWindow = this.host.requireViewerWindow();
        await this.host.prepareForSiteActivation();
        this.host.assertViewerRequestsAccepted();
        // Wait only for authentication state to settle, not Chrome process exit or
        // locked temporary-profile removal. Provider teardown is already retiring.
        await this.cancelExternalLogin(false);
        this.host.assertViewerRequestsAccepted();
        this.closeSitePopups();
        this.destroySiteView();

        const siteSession = session.fromPartition(runtime.partition);
        const siteView = new WebContentsView({
            webPreferences: {
                session: siteSession,
                preload: path.resolve(__dirname, '../preload/viewer.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
                // Provider views are moved between native windows for unified PiP.
                // Disable throttling at construction time so Chromium never starts a
                // streaming document as backgrounded and lets sites pause its media or
                // suspend its audio pipeline during a view/window transition.
                backgroundThrottling: false,
                // HTML5 fullscreen stays inside the host window. Native app fullscreen
                // remains an explicit Kawaikara shortcut.
                disableHtmlFullscreenWindowResize: true,
            },
        });
        // A new WebContentsView starts on Chromium's white about:blank surface.
        // Give it an application-colored native backing before it is attached so
        // Provider changes cannot expose a white transition frame.
        siteView.setBackgroundColor(this.host.getViewerSurfaceColor());
        siteView.setVisible(false);

        this.siteView = siteView;
        this.siteViewSiteId = runtime.siteId;
        this.configureSiteSession(siteSession);
        // Provider injections log with a stable prefix. Forward only those
        // messages instead of every third-party site console line, which keeps
        // the application log useful when diagnosing quality/ad playback.
        this.logging.attachRenderer(
            siteView.webContents,
            'rendererSite',
            (message) =>
                message.includes('[Kawaikara/') ||
                message.startsWith('[video-effects]'),
            runtime.siteId,
        );
        this.attachSiteWebContents(siteView.webContents, siteSession);
        attachWindowSurface(viewerWindow, siteView);
        this.siteViewAttached = true;
        this.syncSiteViewBounds();
        this.host.syncOverlayBounds();
        if (!this.host.logViewer.focusEmbedded())
            this.host.focusUnderlyingLogViewer();
        this.logger.info(
            `Activated ${runtime.siteId} in browser profile ${runtime.id} (${runtime.partition}).`,
        );
        return {
            /** The site session value. */
            siteSession,
            /** The web contents value. */
            webContents: siteView.webContents,
        };
    }

    /** Attaches the site web contents. */
    attachSiteWebContents(
        webContents: WebContents,
        siteSession: Session,
    ): void {
        const webContentsId = webContents.id;
        /** Performs the refresh site surface operation. */
        const refreshSiteSurface = (reason: string): void => {
            setTimeout(() => {
                const siteView = this.siteView;
                if (
                    !this.siteViewAttached ||
                    !siteView ||
                    siteView.webContents.id !== webContentsId ||
                    webContents.isDestroyed() ||
                    !siteView.getVisible()
                ) {
                    return;
                }
                // WebContentsView can occasionally retain a missing compositor
                // surface after a same-document player transition. Reasserting its
                // visibility and invalidating the surface is safe and does not reload
                // or reset the stream.
                siteView.setVisible(true);
                webContents.invalidate();
                this.logger.debug(
                    `Refreshed the site compositor surface (${reason}).`,
                );
            }, 0);
        };
        this.host.connectWindowInput(webContents, 'site');
        bindSiteSurfaceEvents(webContents, siteSession, {
            isCurrent: () =>
                this.host.areViewerRequestsAccepted() &&
                this.siteView?.webContents === webContents,
            getViewer: () => this.host.viewerWindow,
            ready: () =>
                this.host.revealActiveSiteView(webContents, 'dom-ready'),
            applyTheme: (contents) => this.installRemoteThemeBridge(contents),
            refreshSurface: refreshSiteSurface,
            parseAction: (url) => this.parseSiteAction(url),
            dispatchAction: (action) => this.dispatchSiteAction(action),
            allowNavigation: (url) => this.navigationGuard?.(url) ?? true,
            resolveWindowPolicy: (url) =>
                this.newWindowPolicyResolver?.(url) ?? 'viewer',
            navigated: (url) => {
                if (this.siteView?.webContents !== webContents) return;
                // Evaluate committed routes, never intermediate SPA navigation URLs.
                if (
                    this.host.pictureInPicture.isActive() &&
                    this.host.pictureInPictureGuard?.(url) !== true
                )
                    void this.host.exitPictureInPictureForTransition();
            },
            clearEditing: () =>
                this.host.editingWebContentsIds.delete(webContentsId),
            titleChanged: () =>
                this.host.viewerWindow?.setTitle(this.host.appTitle),
            devToolsChanged: (open) => {
                if (open) {
                    this.host.keepSiteDevToolsOpen = true;
                    this.host.configureDevToolsWebContents(webContents);
                } else if (this.siteView?.webContents === webContents) {
                    this.host.keepSiteDevToolsOpen = false;
                }
            },
            popupOpened: (popup) => this.sitePopupWindows.add(popup),
            popupClosed: (popup) => this.sitePopupWindows.delete(popup),
            logger: this.logger,
        });

        if (this.host.openDevToolsOnInitialSite) {
            this.host.openDevToolsOnInitialSite = false;
            this.host.keepSiteDevToolsOpen = true;
        }
        if (this.host.keepSiteDevToolsOpen) {
            // A site switch replaces the WebContentsView. Reattach DevTools to the
            // replacement instead of making developers reopen it for every Provider.
            queueMicrotask(() => this.host.openActiveSiteDevTools(false));
        }
    }

    /** Installs the remote theme bridge. */
    installRemoteThemeBridge(webContents: WebContents): void {
        if (webContents.isDestroyed()) return;
        void webContents
            .executeJavaScript(createRemoteThemeBridgeInjectionScript(), true)
            .catch((error: unknown) => {
                this.logger.debug(
                    'The live site theme bridge could not be installed.',
                    error,
                );
            });
    }

    /** Performs the configure site session operation. */
    configureSiteSession(siteSession: Session): void {
        if (this.configuredSiteSessions.has(siteSession)) return;
        this.configuredSiteSessions.add(siteSession);
        siteSession.webRequest.onBeforeRequest((details, callback) => {
            if (!this.isActiveSiteRequest(siteSession, details.webContentsId)) {
                callback({});
                return;
            }
            const transformed = this.requestTransformer?.({
                url: details.url,
                method: details.method,
                requestHeaders: {},
            });
            callback(transformed ?? {});
        });
        siteSession.webRequest.onBeforeSendHeaders((details, callback) => {
            if (!this.isActiveSiteRequest(siteSession, details.webContentsId)) {
                callback({ requestHeaders: details.requestHeaders });
                return;
            }
            let requestHeaders =
                this.requestHeadersTransformer?.({
                    url: details.url,
                    method: details.method,
                    requestHeaders: details.requestHeaders,
                }) ?? details.requestHeaders;
            const identity = this.siteBrowserIdentity;
            if (
                identity &&
                /^https:\/\//i.test(details.url) &&
                (!identity.requestHosts?.length ||
                    matchesSiteUrlHost(details.url, identity.requestHosts))
            ) {
                requestHeaders = { ...requestHeaders };
                setRequestHeader(
                    requestHeaders,
                    'User-Agent',
                    identity.userAgent,
                );
                if (identity.clientHints) {
                    setRequestHeader(
                        requestHeaders,
                        'Sec-Ch-Ua',
                        identity.clientHints,
                    );
                }
            }
            callback({ requestHeaders });
        });
    }

    /** Retired views/profiles cannot inherit the successor's request policy or UA. */
    isActiveSiteRequest(
        siteSession: Session,
        webContentsId: number | undefined,
    ): boolean {
        const current = this.siteView?.webContents;
        if (
            !current ||
            current.isDestroyed() ||
            current.session !== siteSession
        )
            return false;
        // OAuth popup navigation can begin before did-create-window registers it.
        // Keep the Session's existing policy for live popups/workers, but not a
        // captured outgoing view whose requests arrive after the native handoff.
        return (
            webContentsId === undefined ||
            webContentsId < 0 ||
            !this.retiredSiteWebContentsIds.has(webContentsId)
        );
    }

    /** Performs the destroy site view operation. */
    destroySiteView(): void {
        const siteView = this.siteView;
        this.siteView = undefined;
        this.siteViewSiteId = undefined;
        if (!siteView) return;
        const webContentsId = siteView.webContents.id;
        this.retiredSiteWebContentsIds.add(webContentsId);
        if (siteView.webContents.isDevToolsOpened()) {
            this.host.keepSiteDevToolsOpen = true;
            const devToolsContents = siteView.webContents.devToolsWebContents;
            const devToolsWindow =
                devToolsContents && !devToolsContents.isDestroyed()
                    ? BrowserWindow.fromWebContents(devToolsContents)
                    : null;
            if (
                this.host.devToolsMode === 'detach' &&
                devToolsWindow &&
                devToolsWindow !== this.host.viewerWindow &&
                !devToolsWindow.isDestroyed()
            ) {
                this.host.detachedDevToolsBounds = devToolsWindow.getBounds();
            }
        }
        this.host.editingWebContentsIds.delete(webContentsId);
        const viewerWindow = this.host.viewerWindow;
        if (
            viewerWindow &&
            !viewerWindow.isDestroyed() &&
            this.siteViewAttached
        ) {
            detachWindowSurface(viewerWindow, siteView);
        }
        this.siteViewAttached = false;
        if (!siteView.webContents.isDestroyed()) {
            // Closing the retired native document stops media without asking its JS
            // renderer to respond first; no old network/cleanup wait gates the new URL.
            siteView.webContents.setAudioMuted(true);
            siteView.webContents.stop();
            siteView.webContents.close();
        }
    }

    /** A captured outgoing capability must never operate on successor-owned state. */
    requireCurrentSiteContext(webContents: WebContents): void {
        this.host.assertViewerRequestsAccepted();
        if (
            webContents.isDestroyed() ||
            this.siteView?.webContents !== webContents
        ) {
            throw new Error('The site WebContents is no longer active.');
        }
    }

    /** Creates the site viewer. */
    createSiteViewer(
        webContents: WebContents,
        permissions: ReadonlySet<string>,
    ): SiteViewer {
        /** Returns the web contents. */
        const getWebContents = () => {
            this.requireCurrentSiteContext(webContents);
            return webContents;
        };
        return {
            /** The load URL value. */
            loadURL: async (url) => {
                if (!permissions.has('navigation')) {
                    throw new Error(
                        'This Provider does not have the navigation permission.',
                    );
                }
                const contents = getWebContents();
                await this.prepareViewerTransition(contents);
                getWebContents();
                this.host.currentVideoOpenRequest = null;
                await loadURLWithNavigationRecovery(contents, url);
                getWebContents();
                this.host.revealActiveSiteView(contents, 'load-complete');
                // A Provider load establishes a new site boundary. Chromium otherwise
                // keeps the previous Provider's document in this shared WebContents.
                contents.navigationHistory.clear();
            },
            /** The load internal view value. */
            loadInternalView: async (viewId) => {
                if (!permissions.has('internal-view')) {
                    throw new Error(
                        'This Provider does not have the internal-view permission.',
                    );
                }
                if (viewId !== 'video') {
                    throw new Error(`Unknown internal view: ${viewId}`);
                }
                const contents = getWebContents();
                await this.prepareViewerTransition(contents);
                getWebContents();
                await this.host.presentInternalVideo();
            },
        };
    }

    /** Performs the use site browser identity operation. */
    useSiteBrowserIdentity(
        webContents: WebContents,
        options: SiteBrowserIdentityOptions,
    ): Disposable {
        this.requireCurrentSiteContext(webContents);
        if (
            options.requestHosts?.some(
                (host) =>
                    !/^[a-z0-9.-]+$/i.test(host) ||
                    host.startsWith('.') ||
                    host.endsWith('.'),
            )
        ) {
            throw new Error(
                'Browser identity contains an invalid request host.',
            );
        }
        const defaultUserAgent = webContents.getUserAgent();
        const userAgent =
            options.userAgent === 'chromium'
                ? createChromiumUserAgent(defaultUserAgent)
                : options.userAgent.trim();
        if (!userAgent || /[\r\n]/.test(userAgent)) {
            throw new Error('Browser identity contains an invalid user agent.');
        }
        const clientHints =
            options.clientHints === 'auto'
                ? createChromiumClientHints(userAgent)
                : options.clientHints;
        if (clientHints && /[\r\n]/.test(clientHints)) {
            throw new Error('Browser identity contains invalid Client Hints.');
        }
        const identity = {
            userAgent,
            requestHosts: options.requestHosts,
            clientHints,
        };
        this.siteBrowserIdentity = identity;
        webContents.setUserAgent(userAgent);
        return {
            /** The dispose value. */
            dispose: () => {
                if (this.siteBrowserIdentity !== identity) return;
                this.siteBrowserIdentity = undefined;
                if (!webContents.isDestroyed())
                    webContents.setUserAgent(defaultUserAgent);
            },
        };
    }

    /** Prepares the viewer transition. */
    async prepareViewerTransition(webContents: WebContents): Promise<void> {
        this.requireCurrentSiteContext(webContents);
        await this.host.exitPictureInPictureForTransition();
        this.requireCurrentSiteContext(webContents);
        this.closeSitePopups();
        await prepareCurrentDocumentForNavigation(webContents);
    }

    /** Runs the external login. */
    async runExternalLogin(
        options: Parameters<SiteExternalBrowser['login']>[0],
        webContents: WebContents,
        targetSession: Session,
        viewer: SiteViewer,
    ): ReturnType<SiteExternalBrowser['login']> {
        this.requireCurrentSiteContext(webContents);
        const returnUrl = options.returnUrl ?? webContents.getURL();
        const generation = ++this.externalLoginGeneration;

        this.closeSitePopups();
        await webContents.loadFile(
            path.resolve(__dirname, '../renderer/external-login.html'),
            {
                query: {
                    data: JSON.stringify(
                        getExternalLoginViewData(
                            this.host.appLocale,
                            this.host.systemLocale,
                            options.siteTitle,
                            this.host.appTheme,
                        ),
                    ),
                },
            },
        );
        if (
            generation !== this.externalLoginGeneration ||
            webContents.isDestroyed() ||
            this.siteView?.webContents !== webContents
        )
            return 'cancelled';
        // The waiting document is an application implementation detail, not a
        // destination the user should revisit with Back or Forward.
        webContents.navigationHistory.clear();

        try {
            this.requireCurrentSiteContext(webContents);
            if (generation !== this.externalLoginGeneration) return 'cancelled';
            return await this.externalBrowser.login(
                options,
                targetSession,
                webContents,
            );
        } finally {
            if (
                generation === this.externalLoginGeneration &&
                !webContents.isDestroyed() &&
                returnUrl
            ) {
                await viewer.loadURL(returnUrl).catch((error: unknown) => {
                    this.logger.error(
                        `Failed to restore ${returnUrl} after external login.`,
                        error,
                    );
                });
            }
        }
    }

    /** Determines whether the cel external login condition applies. */
    async cancelExternalLogin(waitForCleanup = true): Promise<void> {
        ++this.externalLoginGeneration;
        if (waitForCleanup) await this.externalBrowser.close();
        else await this.externalBrowser.cancelLogin();
    }

    /** Performs the sync site view bounds operation. */
    syncSiteViewBounds(): void {
        if (
            !this.host.viewerWindow ||
            !this.siteView ||
            !this.siteViewAttached ||
            this.host.pictureInPicture.isActive()
        ) {
            return;
        }
        const [width, height] = this.host.viewerWindow.getContentSize();
        this.siteView.setBounds({ x: 0, y: 0, width, height });
    }

    /** Closes the site popups. */
    closeSitePopups(): void {
        for (const popupWindow of this.sitePopupWindows) {
            if (!popupWindow.isDestroyed()) {
                popupWindow.close();
            }
        }
        this.sitePopupWindows.clear();
    }

    /** Parses the site action. */
    parseSiteAction(url: string): string | undefined {
        try {
            const parsed = new URL(url);
            if (
                parsed.protocol !== 'kawaikara-action:' ||
                parsed.hostname !== 'invoke'
            ) {
                return undefined;
            }
            const action = decodeURIComponent(
                parsed.pathname.replace(/^\//, ''),
            );
            return action || undefined;
        } catch {
            return undefined;
        }
    }

    /** Performs the require site web contents operation. */
    requireSiteWebContents(): WebContents {
        return this.requireSiteView().webContents;
    }

    /** Performs the require site view operation. */
    requireSiteView(): WebContentsView {
        const siteView = this.siteView;
        const webContents = siteView?.webContents;
        if (!webContents || webContents.isDestroyed()) {
            throw new Error(
                'The site viewer WebContentsView has not been created.',
            );
        }
        return siteView;
    }
}
/** Determines whether an address belongs to a user-visible remote page. */
function isUserNavigableHistoryUrl(value: string): boolean {
    try {
        const protocol = new URL(value).protocol;
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}
