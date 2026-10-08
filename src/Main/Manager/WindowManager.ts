import { getLocaleMessages } from '../Functional/Locale';
import path from 'node:path';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  screen,
  session,
  type Input,
  type Rectangle,
  type Session,
  type WebContents,
  WebContentsView,
} from 'electron';
import { createMpvMain, type MpvMain } from 'electron-mpv-video';
import type {
  Disposable,
  NewWindowPolicy,
  SiteContext,
  SiteRequestDetails,
  SiteRequestHeaders,
  SiteRequestRedirect,
  SiteBrowserIdentityOptions,
  SiteExternalBrowser,
  SiteLogger,
  SiteViewer,
  PictureInPictureSubtitleController,
  ProviderPictureInPictureSession,
} from '@kawaikara/site-api';
import {
  createChromiumClientHints,
  createChromiumUserAgent,
  matchesSiteUrlHost,
  setRequestHeader,
} from '@kawaikara/site-api';
import { ExternalBrowserManager } from './ExternalBrowserManager';
import { UnifiedPictureInPictureManager } from './UnifiedPictureInPictureManager';
import type { SiteRuntimeProfile } from '../Functional/SiteRuntime';
import {
  IPC_CHANNELS,
  type ApplicationUpdatePanelState,
  type AppLocale,
  type AppTheme,
  type DisplayInfo,
  type DevToolsMode,
  type DevelopmentState,
  type OverlayView,
  type SiteNavigationState,
  type VideoPlaybackCapabilities,
  type VideoOpenRequest,
  type VideoPresentationState,
} from '../../Common/IPC';
import {
  DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
  DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
  DEFAULT_PICTURE_IN_PICTURE_SIZE,
  PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM,
  resolvePictureInPictureSize,
  type PictureInPictureLastPlacement,
  type PictureInPicturePlacementPreference,
  type PictureInPictureSizePreference,
} from '../../Common/PictureInPicture';
import { getExternalLoginViewData } from '../Functional/Locale';
import { getAppMessages } from '../Functional/RendererMessages';
import type { SiteTransitionState } from '../../Common/SiteTransition';
import {
  createSiteTransitionSurfaceHtml,
  createUpdateSiteTransitionSurfaceScript,
} from '../Inject/SiteTransitionSurface';
import { transferWebContentsView } from '../Functional/WebContentsViewTransfer';
import { createMpvViewHost } from '../Functional/MpvViewHost';
import {
  trackPictureInPictureVisibility,
  type PictureInPictureVisibilityTracker,
} from '../Functional/PictureInPictureVisibility';
import { openInDefaultBrowser } from '../Functional/DefaultBrowser';
import { createSitePagePipeline } from '../Functional/SitePagePipeline';
import { createVideoEffectsHost } from '../Functional/VideoEffectsHost';
import type {
  InternalVideoPictureInPictureState,
  PictureInPictureManagerFactory,
} from '../Functional/WindowRuntime';
import { createRemoteThemeBridgeInjectionScript } from '../Inject/RemoteTheme';
import type { LoggingManager } from './LoggingManager';
import {
  disableMacOSFullScreenAuxiliary,
  enableMacOSFullScreenAuxiliary,
} from '../Functional/MacOSWindowSpaces';
import {
  createExternalFullscreenMonitor,
} from '../Functional/ExternalFullscreenMonitor';
import {
  captureInternalVideoPictureInPicturePlacement,
  createSiteCookieStore,
  handleNativeEditingShortcut,
  loadURLWithNavigationRecovery,
  normalizeVideoDimension,
  prepareCurrentDocumentForNavigation,
  resolveInternalVideoPictureInPictureBounds,
  resolveMpvAddonPath,
} from '../Functional/WindowOperations';

/** Defines the shared video file extensions constant. */
const VIDEO_FILE_EXTENSIONS = new Set([
  '.3gp',
  '.avi',
  '.flv',
  '.m2ts',
  '.m4v',
  '.mkv',
  '.mov',
  '.mp4',
  '.mpeg',
  '.mpg',
  '.mts',
  '.ogv',
  '.ts',
  '.webm',
  '.wmv',
]);
/** Defines the Video renderer initialization timeout constant. */
const VIDEO_RENDERER_INITIALIZATION_TIMEOUT_MS = 5_000;
/** Allows foreground window state to settle after a native platform event. */
const EXTERNAL_FULLSCREEN_EVENT_SETTLE_MS = 40;
/** Defines the shared remote scrollbar CSS constant. */
const REMOTE_SCROLLBAR_CSS = `
  :root {
    scrollbar-color: transparent transparent !important;
    scrollbar-width: auto !important;
  }
  *::-webkit-scrollbar {
    width: 12px !important;
    height: 12px !important;
  }
  *::-webkit-scrollbar-track {
    background: transparent !important;
  }
  *::-webkit-scrollbar-button,
  *::-webkit-scrollbar-button:single-button {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    -webkit-appearance: none !important;
    background: transparent !important;
  }
  *::-webkit-scrollbar-corner {
    background: transparent !important;
  }
  *::-webkit-scrollbar-thumb {
    border: 2px solid transparent !important;
    border-radius: 999px !important;
    background: transparent !important;
    background-clip: padding-box !important;
    transition: background-color 180ms ease !important;
  }
  html[data-kawaikara-scrolling="true"] {
    scrollbar-color: rgb(161 161 170 / 58%) transparent !important;
  }
  html[data-kawaikara-scrolling="true"]::-webkit-scrollbar-thumb,
  html[data-kawaikara-scrolling="true"] *::-webkit-scrollbar-thumb {
    background-color: rgb(161 161 170 / 58%) !important;
  }
`;

/** Coordinates window behavior. */
export class WindowManager {
  /** The external browser value. */
  private readonly externalBrowser: ExternalBrowserManager;
  /** The MPV value. */
  private readonly mpv: MpvMain = createMpvMain({
    /** The addon path value. */
    addonPath: resolveMpvAddonPath(),
  });
  // Provider PiP has one application-owned implementation. Site-specific
  // policy is supplied through the Provider API, never a parallel manager.
  /** The picture in picture value. */
  private readonly pictureInPicture: UnifiedPictureInPictureManager;
  /** The editing web contents IDs value. */
  private readonly editingWebContentsIds = new Set<number>();
  /** The site popup Windows value. */
  private readonly sitePopupWindows = new Set<BrowserWindow>();
  /** The app title value. */
  private appTitle = getAppMessages('system', app.getLocale()).title;
  /** The app locale value. */
  private appLocale: AppLocale = 'system';
  /** The app theme value. */
  private appTheme: AppTheme = 'dark';
  /** The system locale value. */
  private systemLocale = 'en-US';
  /** The viewer window value. */
  private viewerWindow?: BrowserWindow;
  /** The retained internal Video renderer. */
  private videoView?: WebContentsView;
  /** The in-flight Video renderer load. */
  private videoViewLoading?: Promise<WebContentsView>;
  /** Native-player adapters keyed by their retained Video views. */
  private readonly mpvVideoHosts = new WeakMap<WebContentsView, BrowserWindow>();
  /** The video software renderer value. */
  private videoSoftwareRenderer = false;
  /** The video renderer recovery value. */
  private videoRendererRecovery?: Promise<boolean>;
  /** The video renderer initialization timer value. */
  private videoRendererInitializationTimer?: ReturnType<typeof setTimeout>;
  /** The Video renderer WebContents currently covered by the timer. */
  private videoRendererInitializationWebContentsId?: number;
  /** The Video renderer WebContents that most recently reported ready. */
  private readyVideoRendererWebContentsId?: number;
  /** The retained Menu, Preferences, and Update renderer. */
  private overlaySurface?: WebContentsView;
  /** The site view value. */
  private siteView?: WebContentsView;
  /** Provider identity associated with the currently attached native view. */
  private siteViewSiteId?: string;
  /** Latest queued Provider lifecycle feedback. */
  private siteTransitionState?: SiteTransitionState;
  /** Initial app-owned backing-page navigation, independent of remote sites. */
  private siteTransitionSurfaceReady?: Promise<boolean>;
  /** Rejects stale asynchronous backing-page updates. */
  private siteTransitionSurfaceRevision = 0;
  /** Start time used to diagnose blank-surface latency without logging URLs. */
  private siteTransitionStartedAt = 0;
  /** The site view attached value. */
  private siteViewAttached = false;
  /** The internal video visible value. */
  private internalVideoVisible = false;
  /** The internal video presentation value. */
  private internalVideoPresentation: VideoPresentationState = {
    /** Whether the ready option is enabled. */
    ready: false,
    /** The width value. */
    width: 0,
    /** The height value. */
    height: 0,
  };
  /** The internal video picture in picture value. */
  private internalVideoPictureInPicture?: InternalVideoPictureInPictureState;
  /** The app always on top value. */
  private appAlwaysOnTop = false;
  /** The platform implementation of external fullscreen monitoring. */
  private readonly externalFullscreenMonitor =
    createExternalFullscreenMonitor();
  /** Whether external fullscreen currently blocks the requested AOT state. */
  private externalFullscreenBlocksAlwaysOnTop = false;
  /** Whether the external fullscreen monitor is running. */
  private externalFullscreenMonitoring = false;
  /** The pending event-driven external fullscreen refresh. */
  private externalFullscreenRefreshTimer?: ReturnType<typeof setTimeout>;
  /** One bounded follow-up for fullscreen geometry that settles after activation. */
  private externalFullscreenSettleTimer?: ReturnType<typeof setTimeout>;
  /** The picture in picture placement value. */
  private pictureInPicturePlacement = DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;
  /** The picture in picture portrait size value. */
  private pictureInPicturePortraitSize =
    DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE;
  /** The picture in picture size value. */
  private pictureInPictureSize = DEFAULT_PICTURE_IN_PICTURE_SIZE;
  /** The configured site sessions value. */
  private readonly configuredSiteSessions = new WeakSet<Session>();
  /** Reject late requests from retired views without excluding a popup's first request. */
  private readonly retiredSiteWebContentsIds = new Set<number>();
  /** The overlay visible value. */
  private overlayVisible = false;
  /** The overlay view value. */
  private overlayView: OverlayView = 'menu';
  /** The restore menu after picture in picture value. */
  private restoreMenuAfterPictureInPicture = false;
  /** The close menu on escape value. */
  private closeMenuOnEscape = true;
  /** The close menu on outside click value. */
  private closeMenuOnOutsideClick = true;
  /** The dev tools mode value. */
  private devToolsMode: DevToolsMode = 'detach';
  /** The open dev tools on initial site value. */
  private openDevToolsOnInitialSite = false;
  /** The keep site dev tools open value. */
  private keepSiteDevToolsOpen = false;
  /** The detached dev tools bounds value. */
  private detachedDevToolsBounds?: Rectangle;
  /** The configured dev tools contents value. */
  private readonly configuredDevToolsContents = new WeakSet<WebContents>();
  /** The configured dev tools Windows value. */
  private readonly configuredDevToolsWindows = new WeakSet<BrowserWindow>();
  /** The current video open request value. */
  private currentVideoOpenRequest: VideoOpenRequest | null = null;
  /** The pending video open request value. */
  private pendingVideoOpenRequest?: VideoOpenRequest;
  /** The last local video open request value. */
  private lastLocalVideoOpenRequest?: Extract<
    VideoOpenRequest,
    {
      /** The kind value. */
      readonly kind: 'local';
    }
  >;
  /** The external login generation value. */
  private externalLoginGeneration = 0;
  /** Callback used to handle new window policy resolver. */
  private newWindowPolicyResolver?: (url: string) => NewWindowPolicy;
  /** Callback used to handle site action handler. */
  private siteActionHandler?: (action: string) => Promise<boolean>;
  /** Callback used to handle navigation guard. */
  private navigationGuard?: (url: string) => boolean;
  /** Callback used to handle picture in picture guard. */
  private pictureInPictureGuard?: (url: string) => boolean;
  /** Callback used to handle picture in picture content overlay selectors. */
  private pictureInPictureContentOverlaySelectors?: () => readonly string[];
  /** Callback used to handle picture in picture state handler. */
  private pictureInPictureStateHandler?: (active: boolean) => void;
  /** Callback used to handle shortcut handler. */
  private shortcutHandler?: (input: Input, editing: boolean) => boolean;
  /** Callback used to handle request headers transformer. */
  private requestHeadersTransformer?: (
    details: SiteRequestDetails,
  ) => SiteRequestHeaders | undefined;
  /** Callback used to handle request transformer. */
  private requestTransformer?: (
    details: SiteRequestDetails,
  ) => SiteRequestRedirect | undefined;
  /** The site browser identity value. */
  private siteBrowserIdentity?: {
    /** The user agent value. */
    readonly userAgent: string;
    /** The request hosts value. */
    readonly requestHosts?: readonly string[];
    /** The client hints value. */
    readonly clientHints?: string;
  };
  /** Callback used to handle picture in picture placement recorder. */
  private pictureInPicturePlacementRecorder?: (
    placement: PictureInPictureLastPlacement,
  ) => Promise<void> | void;
  /** The restoring picture in picture value. */
  private restoringPictureInPicture = false;
  /** The disposing value. */
  private disposing = false;
  /** The viewer close prepared value. */
  private viewerClosePrepared = false;
  /** The viewer close preparation value. */
  private viewerClosePreparation?: Promise<void>;
  /** The internal video picture in picture reassert timers value. */
  private readonly internalVideoPictureInPictureReassertTimers = new Set<
    ReturnType<typeof setTimeout>
  >();
  /** Shared app-level native visibility policy for the internal Video PiP. */
  private internalVideoPictureInPictureVisibility?: PictureInPictureVisibilityTracker;
  /** The overlay reveal timer value. */
  private overlayRevealTimer?: ReturnType<typeof setTimeout>;
  /** The registered window manager logger value. */
  private readonly logger;

  /** Creates an instance of WindowManager. */
  constructor(
    externalBrowser: ExternalBrowserManager,
    createPictureInPicture: PictureInPictureManagerFactory,
    /** The logging value. */
    private readonly logging: LoggingManager,
  ) {
    this.logger = logging.getLogger('windowManager');
    this.externalBrowser = externalBrowser;
    this.pictureInPicture = createPictureInPicture(
      () => this.requireViewerWindow(),
      () => this.requireSiteView(),
      () => this.pictureInPictureContentOverlaySelectors?.() ?? [],
      this.logging,
      (result) => {
        if (result.status === 'entered') {
          this.suspendViewerAlwaysOnTopForPictureInPicture();
        } else if (result.status === 'exited') {
          this.restoreViewerAlwaysOnTopAfterPictureInPicture();
        }
        const overlaySurface = this.overlaySurface;
        if (overlaySurface && !overlaySurface.webContents.isDestroyed()) {
          overlaySurface.webContents.send(
            IPC_CHANNELS.media.pictureInPictureChanged,
            result,
          );
        }
        this.pictureInPictureStateHandler?.(result.status === 'entered');
      },
      () => {
        const viewer = this.viewerWindow;
        if (!this.disposing && viewer && !viewer.isDestroyed()) {
          this.focusViewer();
          this.restoreOverlayAfterPictureInPicture();
        }
      },
      (placement) => this.pictureInPicturePlacementRecorder?.(placement),
      () => this.appLocale,
    );
  }

  /** Creates the Windows. */
  createWindows(): void {
    if (this.viewerWindow) {
      return;
    }

    const viewerWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 720,
      minHeight: 480,
      title: this.appTitle,
      backgroundColor: this.getViewerSurfaceColor(),
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.resolve(__dirname, '../preload/viewer.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webgl: true,
        backgroundThrottling: false,
        // electron-mpv-video composes its contextBridge from the preload.
        // Remote sites remain isolated in their sandboxed WebContentsView.
        sandbox: false,
      },
    });

    const overlaySurface = new WebContentsView({
      webPreferences: {
        preload: path.resolve(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    // Unlike BrowserView, WebContentsView defaults to an opaque white backing.
    overlaySurface.setBackgroundColor('#00000000');
    overlaySurface.setVisible(false);
    viewerWindow.contentView.addChildView(overlaySurface);

    this.viewerWindow = viewerWindow;
    this.overlaySurface = overlaySurface;
    this.disposing = false;
    this.viewerClosePrepared = false;
    this.logging.attachRenderer(viewerWindow.webContents, 'rendererViewer');
    this.siteTransitionSurfaceReady = viewerWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(createSiteTransitionSurfaceHtml(this.appTheme))}`,
    ).then(() => true, (error: unknown) => {
      this.logger.warn('The app-owned site transition surface could not be loaded.', error);
      return false;
    });
    void this.siteTransitionSurfaceReady.then(() => this.renderSiteTransitionSurface());
    this.logging.attachRenderer(overlaySurface.webContents, 'rendererOverlay');
    viewerWindow.setMenu(null);
    viewerWindow.setMenuBarVisibility(false);
    const overlayWebContentsId = overlaySurface.webContents.id;
    const viewerWebContentsId = viewerWindow.webContents.id;
    this.syncSiteViewBounds();
    this.syncVideoViewBounds();
    this.syncOverlayBounds();

    viewerWindow.on('move', () => {
      this.syncSiteViewBounds();
      this.syncVideoViewBounds();
      this.syncOverlayBounds();
    });
    viewerWindow.on('moved', () => {
      // Windows can overwrite topmost z-order changes made while its modal
      // move loop is active. Evaluate the final display and reassert the
      // resulting presentation only after the native move has completed.
      this.refreshExternalFullscreenState(true);
    });
    viewerWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
      this.logger.info(
        `Electron always-on-top state changed: ${String(isAlwaysOnTop)}.`,
      );
    });
    /** Notifies the full screen changed. */
    const notifyFullScreenChanged = () => {
      const videoView = this.videoView;
      if (videoView && !videoView.webContents.isDestroyed()) {
        videoView.webContents.send(
          IPC_CHANNELS.application.fullScreenChanged,
          viewerWindow.isFullScreen(),
        );
      }
    };
    viewerWindow.on('enter-full-screen', notifyFullScreenChanged);
    viewerWindow.on('leave-full-screen', notifyFullScreenChanged);
    viewerWindow.on('resize', () => {
      this.syncSiteViewBounds();
      this.syncVideoViewBounds();
      this.syncOverlayBounds();
      this.refreshExternalFullscreenState();
    });
    viewerWindow.on('show', () => {
      this.refreshActiveContentSurface('viewer-show');
    });
    viewerWindow.on('restore', () => {
      this.refreshActiveContentSurface('viewer-restore');
    });
    viewerWindow.on('focus', () => {
      this.refreshExternalFullscreenState();
      // Restore keyboard focus to the active Video view after host activation.
      if (!this.internalVideoVisible || this.overlayVisible) return;
      setTimeout(() => this.focusInternalVideoView(), 0);
    });
    viewerWindow.on('app-command', (_event, command) => {
      this.routeVideoDirectoryNavigation(command);
    });
    viewerWindow.on('close', (event) => {
      if (!this.disposing && !this.viewerClosePrepared) {
        event.preventDefault();
        if (!this.viewerClosePreparation) {
          this.viewerClosePreparation = this.prepareViewerWindowClose(viewerWindow);
        }
      }
    });
    viewerWindow.on('closed', () => {
      this.clearInternalVideoPictureInPictureReassertions();
      this.clearInternalVideoPictureInPicturePointerMonitor();
      this.clearOverlayRevealTimer();
      this.stopExternalFullscreenMonitoring();
      this.clearVideoRendererInitializationWatchdog();
      this.pictureInPicture.handleViewerClosed();
      const siteWebContentsId = this.siteView?.webContents.id;
      if (siteWebContentsId) this.editingWebContentsIds.delete(siteWebContentsId);
      const videoWebContentsId = this.videoView?.webContents.id;
      if (videoWebContentsId) this.editingWebContentsIds.delete(videoWebContentsId);
      this.editingWebContentsIds.delete(overlayWebContentsId);
      this.editingWebContentsIds.delete(viewerWebContentsId);
      this.destroySiteView();
      if (this.videoView && !this.videoView.webContents.isDestroyed()) {
        // `closed` has already destroyed the native container; the retained
        // video renderer can still be alive during application shutdown.
        if (!viewerWindow.isDestroyed()) viewerWindow.contentView.removeChildView(this.videoView);
        this.videoView.webContents.close();
      }
      if (!overlaySurface.webContents.isDestroyed()) {
        overlaySurface.webContents.close();
      }
      this.viewerWindow = undefined;
      this.videoView = undefined;
      this.overlaySurface = undefined;
      this.overlayVisible = false;
      this.viewerClosePrepared = false;
      this.viewerClosePreparation = undefined;
    });

    overlaySurface.webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(overlayWebContentsId);
      if (handleNativeEditingShortcut(overlaySurface.webContents, input, editing)) {
        event.preventDefault();
        return;
      }
      if (
        this.overlayVisible &&
        (this.overlayView === 'preference' || this.overlayView === 'update') &&
        input.type === 'keyDown' &&
        !input.isAutoRepeat &&
        !input.isComposing
      ) {
        const key = input.key.toLowerCase();
        if (key === 'tab') {
          if (this.overlayView === 'preference') {
            // Preferences has pointer-driven navigation; Tab must not move focus
            // into either Preferences or the fixed Menu underlay.
            event.preventDefault();
            return;
          }
        }
        const plainKey =
          !input.control && !input.meta && !input.alt && !input.shift;
        if (
          plainKey &&
          (key === 'escape' || (key === 'backspace' && !editing))
        ) {
          event.preventDefault();
          overlaySurface.webContents.send(IPC_CHANNELS.overlay.requestClose);
          return;
        }
        return;
      }
      if (
        this.overlayVisible &&
        this.overlayView === 'menu' &&
        input.type === 'keyDown' &&
        !input.isAutoRepeat &&
        !input.isComposing &&
        !input.control &&
        !input.meta &&
        !input.alt &&
        !input.shift &&
        input.key.toLowerCase() === 'tab'
      ) {
        event.preventDefault();
        overlaySurface.webContents.send(IPC_CHANNELS.overlay.requestClose);
        return;
      }
      if (
        this.overlayVisible &&
        this.overlayView === 'menu' &&
        this.closeMenuOnEscape &&
        !editing &&
        input.type === 'keyDown' &&
        !input.isAutoRepeat &&
        !input.isComposing &&
        !input.control &&
        !input.meta &&
        !input.alt &&
        !input.shift &&
        input.key.toLowerCase() === 'escape'
      ) {
        event.preventDefault();
        overlaySurface.webContents.send(IPC_CHANNELS.overlay.requestClose);
        return;
      }
      if (
        !editing &&
        this.shortcutHandler?.(input, false)
      ) {
        event.preventDefault();
      }
    });

    overlaySurface.webContents.on('did-start-loading', () => {
      this.editingWebContentsIds.delete(overlayWebContentsId);
    });
    viewerWindow.webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(viewerWebContentsId);
      if (handleNativeEditingShortcut(viewerWindow.webContents, input, editing)) {
        event.preventDefault();
        return;
      }
      if (this.handleInternalVideoShortcutFromHost(input, editing)) {
        event.preventDefault();
        return;
      }
      if (this.shortcutHandler?.(input, editing)) event.preventDefault();
    });
    viewerWindow.webContents.on('did-start-loading', () => {
      this.editingWebContentsIds.delete(viewerWebContentsId);
    });
    viewerWindow.webContents.on('page-title-updated', (event) => {
      event.preventDefault();
      viewerWindow.setTitle(this.appTitle);
    });
  }

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
    ): PictureInPictureSubtitleController | undefined |
      Promise<PictureInPictureSubtitleController | undefined>;
    /** Performs the transform request operation. */
    transformRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined;
    /** Performs the transform request headers operation. */
    transformRequestHeaders(
      details: SiteRequestDetails,
    ): SiteRequestHeaders | undefined;
  }
  ): void {
    this.newWindowPolicyResolver = handlers.resolveNewWindowPolicy;
    this.siteActionHandler = handlers.handleAction;
    this.navigationGuard = handlers.allowNavigation;
    this.pictureInPictureGuard = handlers.allowPictureInPicture;
    this.pictureInPictureContentOverlaySelectors =
      handlers.getPictureInPictureContentOverlaySelectors;
    this.pictureInPicture.setSubtitleControllerFactory(
      (session) => handlers.createPictureInPictureSubtitleController(session),
    );
    this.requestTransformer = handlers.transformRequest;
    this.requestHeadersTransformer = handlers.transformRequestHeaders;
  }

  /** Sets the shortcut handler. */
  setShortcutHandler(handler: (input: Input, editing: boolean) => boolean): void {
    this.shortcutHandler = handler;
  }

  /** Sets the picture in picture state handler. */
  setPictureInPictureStateHandler(handler: (active: boolean) => void): void {
    this.pictureInPictureStateHandler = handler;
    handler(
      this.pictureInPicture.isActive() ||
        this.internalVideoPictureInPicture !== undefined,
    );
  }

  /** Determines whether the picture in picture active condition applies. */
  isPictureInPictureActive(): boolean {
    return this.isAnyPictureInPictureActive();
  }

  /** Releases the operation. */
  async dispose(): Promise<void> {
    this.disposing = true;
    this.stopExternalFullscreenMonitoring();
    this.clearVideoRendererInitializationWatchdog();
    await this.exitInternalVideoPictureInPicture(false);
    await this.pictureInPicture.exitAllModes();
    await this.cancelExternalLogin();
    this.closeSitePopups();
    this.newWindowPolicyResolver = undefined;
    this.siteActionHandler = undefined;
    this.navigationGuard = undefined;
    this.pictureInPictureGuard = undefined;
    this.pictureInPictureContentOverlaySelectors = undefined;
    this.pictureInPicture.setSubtitleControllerFactory(undefined);
    this.pictureInPictureStateHandler = undefined;
    this.requestTransformer = undefined;
    this.requestHeadersTransformer = undefined;
    this.shortcutHandler = undefined;
    this.destroySiteView();
    await this.mpv.dispose();
    const viewer = this.viewerWindow;
    if (viewer && !viewer.isDestroyed()) viewer.destroy();
  }

  /** Performs the queue dropped video files operation. */
  async queueDroppedVideoFiles(value: unknown): Promise<boolean> {
    if (!Array.isArray(value)) {
      return false;
    }
    for (const candidate of value) {
      if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) {
        continue;
      }
      const filePath = path.resolve(candidate);
      if (!VIDEO_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        continue;
      }
      try {
        if (!(await fs.stat(filePath)).isFile()) {
          continue;
        }
      } catch {
        continue;
      }
      const request: Extract<VideoOpenRequest, { readonly kind: 'local'
      }> = {
        kind: 'local',
        displayName: path.basename(filePath),
        directory: path.dirname(filePath),
        path: filePath,
        url: pathToFileURL(filePath).href,
      };
      this.pendingVideoOpenRequest = request;
      this.lastLocalVideoOpenRequest = request;
      return true;
    }
    return false;
  }

  /** Selects the local video. */
  async selectLocalVideo(): Promise<VideoOpenRequest | null> {
    const labels = getLocaleMessages(this.appLocale, this.systemLocale).nativeDialogs;
    const viewer = this.requireViewerWindow();
    const result = await dialog.showOpenDialog(viewer, {
      title: labels.openVideo,
      properties: ['openFile'],
      filters: [
        {
          name: labels.videoFiles,
          extensions: Array.from(VIDEO_FILE_EXTENSIONS, (extension) =>
            extension.slice(1),
          ),
        },
        { name: labels.allFiles, extensions: ['*']
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = path.resolve(result.filePaths[0]);
    try {
      if (!(await fs.stat(filePath)).isFile()) return null;
    } catch {
      return null;
    }
    const request: VideoOpenRequest = {
      kind: 'local',
      displayName: path.basename(filePath),
      directory: path.dirname(filePath),
      path: filePath,
      url: pathToFileURL(filePath).href,
    };
    this.currentVideoOpenRequest = request;
    this.lastLocalVideoOpenRequest = request;
    return request;
  }

  /** Returns the video playback capabilities. */
  getVideoPlaybackCapabilities(): VideoPlaybackCapabilities {
    const nativePlatform =
      (process.platform === 'win32' && process.arch === 'x64') ||
      (process.platform === 'darwin' && process.arch === 'arm64');
    return {
      /** The platform value. */
      platform: process.platform,
      /** The arch value. */
      arch: process.arch,
      /** The native backend available value. */
      nativeBackendAvailable: nativePlatform && existsSync(resolveMpvAddonPath()),
      /** The Electron GPU acceleration enabled value. */
      electronGpuAccelerationEnabled: app.isHardwareAccelerationEnabled(),
      /** The hardware acceleration disabled value. */
      hardwareAccelerationDisabled: process.env.MPV_HWDEC === 'no',
      /** The native render mode value. */
      nativeRenderMode: this.videoSoftwareRenderer
        ? 'software'
        : 'shared-texture',
    };
  }

  /** Performs the queue you tube downloader operation. */
  queueYouTubeDownloader(url: string): void {
    this.pendingVideoOpenRequest = { kind: 'youtube', url
    };
  }

  /** Returns the current video open request. */
  getCurrentVideoOpenRequest(): VideoOpenRequest | null {
    return this.currentVideoOpenRequest;
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

  /** Performs the activate video open request operation. */
  activateVideoOpenRequest(
    webContentsId: number,
    request: Extract<VideoOpenRequest, {
      /** The kind value. */
      readonly kind: 'local';
    }>,
  ): boolean {
    const video = this.videoView;
    if (
      !this.internalVideoVisible ||
      !video ||
      video.webContents.isDestroyed() ||
      video.webContents.id !== webContentsId
    ) {
      return false;
    }
    this.currentVideoOpenRequest = request;
    this.lastLocalVideoOpenRequest = request;
    return true;
  }

  /** Performs the recover video playback renderer operation. */
  recoverVideoPlaybackRenderer(webContentsId: number): Promise<boolean> {
    if (this.videoSoftwareRenderer) return Promise.resolve(false);
    if (this.videoRendererRecovery) return this.videoRendererRecovery;
    const video = this.videoView;
    if (
      this.internalVideoPictureInPicture ||
      !video ||
      video.webContents.isDestroyed() ||
      video.webContents.id !== webContentsId
    ) {
      return Promise.resolve(false);
    }

    const recovery = this.recreateVideoViewWithSoftwareRenderer(video)
      .finally(() => {
        if (this.videoRendererRecovery === recovery) {
          this.videoRendererRecovery = undefined;
        }
      });
    this.videoRendererRecovery = recovery;
    return recovery;
  }

  /** Records that a Video playback renderer completed initialization. */
  notifyVideoPlaybackRendererReady(webContentsId: number): void {
    const video = this.videoView;
    if (
      !video ||
      video.webContents.isDestroyed() ||
      video.webContents.id !== webContentsId
    ) {
      return;
    }
    this.readyVideoRendererWebContentsId = webContentsId;
    this.clearVideoRendererInitializationWatchdog(webContentsId);
  }

  /** Warms the persistent Windows Video surface before its first activation. */
  async prepareInternalVideoView(): Promise<void> {
    if (process.platform !== 'win32' || this.disposing) return;
    const video = await this.ensureVideoView();
    if (
      this.disposing ||
      this.internalVideoVisible ||
      video.webContents.isDestroyed() ||
      this.videoView !== video
    ) {
      return;
    }
    // Keep the renderer inactive until the Video Provider is selected.
    this.setInternalVideoSiteVisibility(video, false);
  }

  /** Recreates the Video view with the software renderer. */
  private async recreateVideoViewWithSoftwareRenderer(
    video: WebContentsView,
  ): Promise<boolean> {
    this.logger.warn(
      'The shared-texture Video renderer did not initialize; retrying with the libmpv WebGL renderer.',
    );
    this.clearVideoRendererInitializationWatchdog(video.webContents.id);
    this.videoSoftwareRenderer = true;
    this.internalVideoPresentation = { ready: false, width: 0, height: 0
    };
    video.setVisible(false);
    await this.detachMpvVideoView(video);
    if (this.videoView === video) this.videoView = undefined;
    this.viewerWindow?.contentView.removeChildView(video);
    video.webContents.close();

    if (!this.internalVideoVisible || this.disposing) return false;
    const replacement = await this.ensureVideoView();
    this.syncVideoViewBounds();
    this.setInternalVideoSiteVisibility(replacement, true);
    replacement.webContents.focus();
    return true;
  }

  /** Performs the queue video open request operation. */
  queueVideoOpenRequest(request: VideoOpenRequest): void {
    this.pendingVideoOpenRequest = request;
    if (request.kind === 'local') this.lastLocalVideoOpenRequest = request;
  }

  /** Delivers a queued request to an already active Video view. */
  presentQueuedVideoOpenRequest(): boolean {
    const request = this.pendingVideoOpenRequest;
    const video = this.videoView;
    if (
      !request ||
      !this.internalVideoVisible ||
      !video ||
      video.webContents.isDestroyed()
    ) {
      return false;
    }
    this.pendingVideoOpenRequest = undefined;
    this.currentVideoOpenRequest = request;
    video.webContents.send(IPC_CHANNELS.video.visibilityChanged, true);
    video.webContents.send(IPC_CHANNELS.video.openRequestChanged, request);
    return true;
  }

  /** Performs the dispatch site action operation. */
  private dispatchSiteAction(action: string): void {
    const handler = this.siteActionHandler;
    if (!handler) {
      this.logger.warn(`No site action handler is registered for: ${action}`);
      return;
    }

    void handler(action).then((handled) => {
      if (!handled) {
        this.logger.warn(`The current site did not handle action: ${action}`);
      }
    }).catch((error: unknown) => {
      this.logger.error(`Site action failed: ${action}`, error);
    });
  }

  /** Loads the overlay. */
  async loadOverlay(): Promise<void> {
    const overlay = this.requireOverlaySurface();
    await overlay.webContents.loadFile(path.resolve(__dirname, '../renderer/index.html'));
  }

  /** Creates the site context. */
  async createSiteContext(
    runtime: SiteRuntimeProfile,
    permissions: ReadonlySet<string>,
  ): Promise<SiteContext> {
    const { siteSession, webContents } = await this.activateSiteView(runtime);
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
          throw new Error('This Provider does not have the external-browser permission.');
        }
        return this.runExternalLogin(options, webContents, siteSession, viewer);
      },
      close: () => permissions.has('external-browser') && this.siteView?.webContents === webContents
        ? this.cancelExternalLogin()
        : Promise.resolve(),
    };
    const page = createSitePagePipeline(webContents, logger);
    return {
      /** The video effects value. */
      videoEffects: permissions.has('script-injection') ? createVideoEffectsHost(webContents, page, logger) : undefined,
      /** The viewer value. */
      viewer,
      // SiteManager keeps this core pipeline for application-owned policies
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
            throw new Error('Site action URLs require script-injection permission.');
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
        ? createSiteCookieStore(siteSession, () => this.requireCurrentSiteContext(webContents))
        : undefined,
      /** The logger value. */
      logger,
      /** The open external value. */
      openExternal: (url) => {
        this.requireCurrentSiteContext(webContents);
        if (!permissions.has('navigation')) {
          throw new Error('Opening an external URL requires navigation permission.');
        }
        return openInDefaultBrowser(url);
      },
    };
  }

  /** Sets the always on top. */
  setAlwaysOnTop(enabled: boolean): void {
    const requestedStateChanged = this.appAlwaysOnTop !== enabled;
    this.appAlwaysOnTop = enabled;
    if (enabled) this.startExternalFullscreenMonitoring();
    else this.stopExternalFullscreenMonitoring();
    const pictureInPictureActive = this.isAnyPictureInPictureActive();
    if (requestedStateChanged) {
      this.logger.info(
        `Always on top requested: ${String(enabled)}; ` +
        `externalFullscreen=${String(this.externalFullscreenBlocksAlwaysOnTop)}; ` +
        `pictureInPicture=${String(pictureInPictureActive)}.`,
      );
    }
    if (!pictureInPictureActive) {
      const viewer = this.viewerWindow;
      if (viewer && !viewer.isDestroyed()) {
        this.applyAlwaysOnTop(
          viewer,
          this.getEffectiveAppAlwaysOnTop(),
          enabled && requestedStateChanged,
        );
      }
    }
  }

  /** Flushes Chromium data and releases MPV without destroying interactive app managers. */
  async prepareForUpdateInstallation(): Promise<void> {
    await this.exitInternalVideoPictureInPicture(false);
    await this.pictureInPicture.exitAllModes();
    const sessions = new Set([session.defaultSession]);
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) sessions.add(window.webContents.session);
    }
    if (this.siteView && !this.siteView.webContents.isDestroyed()) {
      sessions.add(this.siteView.webContents.session);
    }
    if (this.videoView && !this.videoView.webContents.isDestroyed()) {
      sessions.add(this.videoView.webContents.session);
    }
    await Promise.all([...sessions].map(async (current) => {
      current.flushStorageData();
      await current.cookies.flushStore();
    }));
    const video = this.videoView;
    if (video && !video.webContents.isDestroyed()) {
      await this.detachMpvVideoView(video);
      this.videoView = undefined;
      // Unlink first so the destroyed handler does not clear Provider visibility;
      // recovery needs to know which surface the user was interacting with.
      this.viewerWindow?.contentView.removeChildView(video);
      video.webContents.close();
      this.internalVideoPresentation = { ready: false, width: 0, height: 0 };
    }
    // Native installer quit must not be cancelled by the ordinary asynchronous
    // title-bar close path. Reset this gate when installer startup fails.
    this.viewerClosePrepared = true;
  }

  /** Recreates detached Video resources and leaves the error overlay dismissible. */
  async recoverAfterFailedUpdate(): Promise<void> {
    this.viewerClosePrepared = false;
    if (this.disposing) return;
    const existing = this.videoView;
    if (existing && !existing.webContents.isDestroyed()) {
      // Detach can fail after removing its ownership listener. Recreate
      // that surface as well instead of leaving its renderer bound to dead MPV.
      await this.detachMpvVideoView(existing).catch((reason: unknown) => {
        this.logger.warn('Could not detach the failed update Video surface.', reason);
      });
      this.videoView = undefined;
      this.viewerWindow?.contentView.removeChildView(existing);
      existing.webContents.close();
    }
    if (this.internalVideoVisible) {
      // The new renderer reads currentVideoOpenRequest through normal IPC;
      // do not enqueue an older local file over the user's current HLS source.
      const video = await this.ensureVideoView();
      this.syncVideoViewBounds();
      this.setInternalVideoSiteVisibility(video, true);
      if (this.overlayVisible) this.syncOverlayBounds();
    } else {
      await this.prepareInternalVideoView();
    }
  }

  /** Prepares the viewer window close. */
  private async prepareViewerWindowClose(viewer: BrowserWindow): Promise<void> {
    this.disposing = true;
    try {
      // The title-bar close button means application shutdown on every
      // platform. Close both PiP modes first so their native windows cannot
      // keep the macOS process alive after the viewer disappears.
      await this.exitInternalVideoPictureInPicture(false);
      await this.pictureInPicture.exitAllModes();
      // Detach libmpv before closing the Video WebContents.
      const video = this.videoView;
      if (video && !video.webContents.isDestroyed()) {
        await this.detachMpvVideoView(video);
        viewer.contentView.removeChildView(video);
        video.webContents.close();
        this.videoView = undefined;
      }
    } catch (error) {
      this.logger.error('Failed to detach MPV before closing the Video view.', error);
      await this.mpv.dispose().catch((disposeError: unknown) => {
        this.logger.error('Failed to dispose MPV after detach failed.', disposeError);
      });
    } finally {
      this.viewerClosePrepared = true;
      this.viewerClosePreparation = undefined;
      if (!viewer.isDestroyed()) viewer.close();
    }
  }

  /** Applies the always on top. */
  private applyAlwaysOnTop(
    viewer: BrowserWindow,
    enabled: boolean,
    reassertPresentation = false,
  ): void {
    const electronReported = viewer.isAlwaysOnTop();
    const platformReported =
      this.externalFullscreenMonitor.isAlwaysOnTopApplied(viewer);
    const presentationWasLost = process.platform === 'win32' &&
      enabled &&
      electronReported &&
      platformReported === false;
    const raiseAfterEnabling = process.platform === 'win32' && enabled &&
      (reassertPresentation || presentationWasLost || !electronReported);
    if (presentationWasLost) {
      // Windows can clear WS_EX_TOPMOST while Chromium retains its cached
      // kFloatingWindow state. Clear that cache through Electron first so the
      // following enable call reaches the OS again.
      this.logger.info(
        'Reasserting always on top after Windows removed the topmost flag.',
      );
      viewer.setAlwaysOnTop(false);
    }
    const level = process.platform === 'win32' ? 'screen-saver' : 'floating';
    viewer.setAlwaysOnTop(enabled, level);
    if (process.platform === 'darwin') {
      // Normal AOT intentionally stays out of another application's native
      // fullscreen Space. Skipping Electron's process-type transformation
      // prevents each toggle from hiding and re-registering the Dock icon.
      if (viewer.isVisibleOnAllWorkspaces() !== enabled) {
        viewer.setVisibleOnAllWorkspaces(enabled, {
          visibleOnFullScreen: false,
          skipTransformProcessType: true,
        });
      }
    }
    if (
      raiseAfterEnabling &&
      viewer.isVisible() &&
      !viewer.isMinimized()
    ) {
      // Re-entering the topmost band does not guarantee that Windows repairs
      // the existing z-order after an exclusive fullscreen transition.
      // Raise without activation so a viewer moved to another display becomes
      // visible again without stealing keyboard focus from the game.
      viewer.moveTop();
    }
    if (!enabled) this.yieldToExternalFullscreen(viewer);
  }

  /** Restacks behind this display's fullscreen owner, respecting a retained explicit viewer activation. */
  private yieldToExternalFullscreen(viewer: BrowserWindow): void {
    if (
      !this.appAlwaysOnTop || !this.externalFullscreenBlocksAlwaysOnTop ||
      this.isAnyPictureInPictureActive() || viewer.isDestroyed() ||
      !viewer.isVisible() || viewer.isMinimized()
    ) return;
    const anchor = this.externalFullscreenMonitor.getYieldTarget(viewer);
    if (!anchor) return;
    // HWND_NOTOPMOST (setAlwaysOnTop(false)) puts a window at the TOP of the
    // normal band, potentially still above the display's borderless game. Native
    // only supplies a live anchor below that game; Electron moves our own window
    // with SWP_NOACTIVATE. Never hide/minimize, focus the game, or fight z-order
    // continuously once the viewer and its owned windows are already below it.
    viewer.moveAbove(anchor);
    this.logger.info('Yielded application window stacking to external fullscreen.', {
      /** Whether a visible application window still obstructs fullscreen after restacking. */
      stillObstructing: Boolean(this.externalFullscreenMonitor.getYieldTarget(viewer)),
    });
  }

  /** Starts platform fullscreen monitoring while AOT is requested. */
  private startExternalFullscreenMonitoring(): void {
    if (
      this.externalFullscreenMonitoring ||
      !this.externalFullscreenMonitor.supported
    ) {
      return;
    }
    const viewer = this.viewerWindow;
    if (!viewer || viewer.isDestroyed()) return;
    this.externalFullscreenMonitoring = true;
    this.externalFullscreenBlocksAlwaysOnTop =
      this.externalFullscreenMonitor.start(
        viewer,
        () => this.scheduleExternalFullscreenRefresh(),
      );
    screen.on('display-added', this.handleDisplayConfigurationChanged);
    screen.on('display-removed', this.handleDisplayConfigurationChanged);
    screen.on(
      'display-metrics-changed',
      this.handleDisplayConfigurationChanged,
    );
  }

  /** Stops platform fullscreen monitoring when AOT is no longer requested. */
  private stopExternalFullscreenMonitoring(): void {
    if (this.externalFullscreenRefreshTimer) {
      clearTimeout(this.externalFullscreenRefreshTimer);
      this.externalFullscreenRefreshTimer = undefined;
    }
    if (this.externalFullscreenSettleTimer) {
      clearTimeout(this.externalFullscreenSettleTimer);
      this.externalFullscreenSettleTimer = undefined;
    }
    if (this.externalFullscreenMonitoring) {
      this.externalFullscreenMonitor.stop();
      screen.removeListener(
        'display-added',
        this.handleDisplayConfigurationChanged,
      );
      screen.removeListener(
        'display-removed',
        this.handleDisplayConfigurationChanged,
      );
      screen.removeListener(
        'display-metrics-changed',
        this.handleDisplayConfigurationChanged,
      );
      this.externalFullscreenMonitoring = false;
    }
    this.externalFullscreenBlocksAlwaysOnTop = false;
  }

  /** Coalesces native signals without waiting for an event burst to finish. */
  private scheduleExternalFullscreenRefresh(): void {
    if (!this.appAlwaysOnTop || !this.externalFullscreenMonitoring) return;
    // Leave the WinEvent callback before mutating Electron windows, but never
    // restart this timer: continuous location/reorder signals must not starve
    // the first fullscreen response. Re-read the live HWND/display on dispatch
    // instead of applying a snapshot from before the application moved.
    if (!this.externalFullscreenRefreshTimer) {
      this.externalFullscreenRefreshTimer = setTimeout(() => {
        this.externalFullscreenRefreshTimer = undefined;
        this.safelyRefreshExternalFullscreenState(true);
      }, 0);
    }
    // Activation may precede final fullscreen bounds. Keep one non-sliding
    // follow-up, not a polling loop or a debounce that delays the first check.
    if (!this.externalFullscreenSettleTimer) {
      this.externalFullscreenSettleTimer = setTimeout(() => {
        this.externalFullscreenSettleTimer = undefined;
        this.safelyRefreshExternalFullscreenState();
      }, EXTERNAL_FULLSCREEN_EVENT_SETTLE_MS);
    }
  }

  /** Contains asynchronous platform/window failures without stopping later signals. */
  private safelyRefreshExternalFullscreenState(deferRestoration = false): void {
    try {
      this.refreshExternalFullscreenState(false, deferRestoration);
    } catch (error) {
      this.logger.warn(
        'Kawaikara could not apply an external fullscreen state change.',
        error,
      );
    }
  }

  /** Refreshes the platform fullscreen state after an application-side change. */
  private refreshExternalFullscreenState(
    reassertPresentation = false,
    deferRestoration = false,
  ): void {
    if (!this.appAlwaysOnTop || !this.externalFullscreenMonitoring) return;
    const viewer = this.viewerWindow;
    if (!viewer || viewer.isDestroyed()) return;
    const fullscreen = this.externalFullscreenMonitor.refresh(viewer);
    // Yield promptly, but don't raise AOT over the game just because a task
    // switcher briefly owns the foreground. The bounded settled check handles
    // restoration; explicit application moves/focus retain their existing path.
    if (deferRestoration && !fullscreen) return;
    this.handleExternalFullscreenChanged(
      fullscreen,
      reassertPresentation,
    );
  }

  /** Handles a platform external fullscreen state change. */
  private handleExternalFullscreenChanged(
    fullscreen: boolean,
    reassertPresentation = false,
  ): void {
    const suspended = this.appAlwaysOnTop && fullscreen;
    const stateChanged =
      suspended !== this.externalFullscreenBlocksAlwaysOnTop;
    const viewer = this.viewerWindow;
    if (!viewer || viewer.isDestroyed()) return;
    const nativeTopmost = this.externalFullscreenMonitor.isAlwaysOnTopApplied(viewer);
    const presentationWasLost = !suspended && nativeTopmost === false;
    const suppressionWasLost = suspended && nativeTopmost === true;
    if (!stateChanged && !reassertPresentation && !presentationWasLost && !suppressionWasLost) {
      if (suspended) this.yieldToExternalFullscreen(viewer);
      return;
    }
    this.externalFullscreenBlocksAlwaysOnTop = suspended;
    if (stateChanged) {
      this.logger.info(
        suspended
          ? 'Always on top disabled for an external fullscreen app on the same display.'
          : 'Always on top restored after external fullscreen left the display.',
      );
    }
    if (!this.isAnyPictureInPictureActive()) {
      this.applyAlwaysOnTop(
        viewer,
        this.getEffectiveAppAlwaysOnTop(),
        reassertPresentation || presentationWasLost,
      );
    }
  }

  /** Handles display topology changes that can change the relevant monitor. */
  private readonly handleDisplayConfigurationChanged = (): void => {
    this.refreshExternalFullscreenState();
  };

  /** Sets managed window opacity. */
  private setManagedWindowOpacity(window: BrowserWindow, opacity: number): void {
    window.setOpacity(opacity);
  }

  /** Returns the effective application always on top state. */
  private getEffectiveAppAlwaysOnTop(): boolean {
    return this.appAlwaysOnTop &&
      !this.externalFullscreenBlocksAlwaysOnTop;
  }

  /** Determines whether the any picture in picture active condition applies. */
  private isAnyPictureInPictureActive(): boolean {
    return Boolean(
      this.internalVideoPictureInPicture || this.pictureInPicture.isActive(),
    );
  }

  /** Performs the suspend viewer always on top for picture in picture operation. */
  private suspendViewerAlwaysOnTopForPictureInPicture(): void {
    const viewer = this.viewerWindow;
    if (viewer && !viewer.isDestroyed()) this.applyAlwaysOnTop(viewer, false);
  }

  /** Restores the viewer always on top after picture in picture. */
  private restoreViewerAlwaysOnTopAfterPictureInPicture(): void {
    if (this.disposing || this.isAnyPictureInPictureActive()) return;
    const viewer = this.viewerWindow;
    if (!viewer || viewer.isDestroyed()) return;
    this.refreshExternalFullscreenState();
    this.applyAlwaysOnTop(viewer, this.getEffectiveAppAlwaysOnTop());
  }

  /** Sets the menu dismiss behavior. */
  setMenuDismissBehavior(
    closeOnEscape: boolean,
    closeOnOutsideClick: boolean,
  ): void {
    this.closeMenuOnEscape = closeOnEscape;
    this.closeMenuOnOutsideClick = closeOnOutsideClick;
  }

  /** Lists the displays. */
  listDisplays(): DisplayInfo[] {
    const viewerBounds = this.requireViewerWindow().getBounds();
    const currentDisplayId = String(screen.getDisplayMatching(viewerBounds).id);
    const primaryDisplayId = String(screen.getPrimaryDisplay().id);
    return screen.getAllDisplays().map((display, index) => ({
      id: String(display.id),
      label: display.label.trim() || `${getLocaleMessages(this.appLocale, this.systemLocale).app.pipMonitorDisplay} ${String(index + 1)}`,
      width: display.size.width,
      height: display.size.height,
      scaleFactor: display.scaleFactor,
      primary: String(display.id) === primaryDisplayId,
      current: String(display.id) === currentDisplayId,
    }));
  }

  /** Opens the dev tools. */
  openDevTools(mode: DevToolsMode): void {
    const webContents = this.getActiveViewerWebContents();
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('There is no active site view to inspect.');
    }
    this.devToolsMode = mode;
    this.keepSiteDevToolsOpen = true;
    webContents.openDevTools({ mode, activate: true
    });
  }

  /** Performs the configure startup dev tools operation. */
  configureStartupDevTools(openOnStartup: boolean, mode: DevToolsMode): void {
    this.openDevToolsOnInitialSite = openOnStartup;
    this.devToolsMode = mode;
  }

  /** Sets the dev tools mode. */
  setDevToolsMode(mode: DevToolsMode): void {
    this.devToolsMode = mode;
  }

  /** Sets the picture in picture size. */
  setPictureInPictureSize(preference: PictureInPictureSizePreference): void {
    this.pictureInPictureSize = preference;
    this.pictureInPicture.setWindowSize(preference);
  }

  /** Sets the picture in picture portrait size. */
  setPictureInPicturePortraitSize(
    preference: PictureInPictureSizePreference,
  ): void {
    this.pictureInPicturePortraitSize = preference;
    this.pictureInPicture.setPortraitWindowSize(preference);
  }

  /** Apply the common subtitle multiplier to Provider-managed PiP. */
  setPictureInPictureSubtitleScale(scale: number): Promise<void> {
    return this.pictureInPicture.setSubtitleScale(scale);
  }

  /** Sets the picture in picture placement. */
  setPictureInPicturePlacement(
    preference: PictureInPicturePlacementPreference,
  ): void {
    this.pictureInPicturePlacement = preference;
    this.pictureInPicture.setWindowPlacement(preference);
  }

  /** Sets the picture in picture placement recorder. */
  setPictureInPicturePlacementRecorder(
    recorder: (
      placement: PictureInPictureLastPlacement,
    ) => Promise<void> | void,
  ): void {
    this.pictureInPicturePlacementRecorder = recorder;
  }

  /** Toggles the picture in picture. */
  async togglePictureInPicture() {
    if (this.internalVideoVisible) {
      return this.toggleInternalVideoPictureInPicture();
    }
    if (!this.canEnterPictureInPicture()) {
      return {
        /** The status value. */
        status: 'no-video' as const,
        /** The mode value. */
        mode: 'video' as const,
      };
    }
    return this.togglePictureInPictureWithOverlay((beforeEnter) =>
      this.pictureInPicture.toggle(beforeEnter),
    );
  }

  /** Toggles the game picture in picture. */
  async toggleGamePictureInPicture() {
    if (this.internalVideoVisible) {
      return this.toggleInternalVideoPictureInPicture();
    }
    if (!this.canEnterPictureInPicture()) {
      return {
        /** The status value. */
        status: 'no-video' as const,
        /** The mode value. */
        mode: 'window' as const,
      };
    }
    return this.togglePictureInPictureWithOverlay((beforeEnter) =>
      this.pictureInPicture.toggle(beforeEnter),
    );
  }

  /** Determines whether the enter picture in picture condition applies. */
  private canEnterPictureInPicture(): boolean {
    if (this.internalVideoPictureInPicture) return true;
    if (this.pictureInPicture.isActive()) return true;
    const webContents = this.requireSiteWebContents();
    return this.pictureInPictureGuard?.(webContents.getURL()) ?? true;
  }

  /** Toggles the picture in picture with overlay. */
  private async togglePictureInPictureWithOverlay(
    toggle: (
      beforeEnter: () => boolean,
    ) => ReturnType<UnifiedPictureInPictureManager['toggle']>,
  ) {
    const entering = !this.pictureInPicture.isActive();
    let prepared = false;
    /** Performs the before enter operation. */
    const beforeEnter = (): boolean => {
      if (!entering) return true;
      if (!this.prepareOverlayForPictureInPicture()) return false;
      prepared = true;
      this.suspendViewerAlwaysOnTopForPictureInPicture();
      return true;
    };
    let result;
    try {
      result = await toggle(beforeEnter);
    } catch (error) {
      if (prepared) {
        this.restoreViewerAlwaysOnTopAfterPictureInPicture();
        this.restoreOverlayAfterPictureInPicture();
      }
      throw error;
    }
    if (prepared && result.status !== 'entered') {
      this.restoreViewerAlwaysOnTopAfterPictureInPicture();
      this.restoreOverlayAfterPictureInPicture();
    }
    return result;
  }

  /** Restores the picture in picture. */
  private async restorePictureInPicture(): Promise<void> {
    if (this.restoringPictureInPicture) return;
    this.restoringPictureInPicture = true;
    try {
      const restoreInternalViewer = this.internalVideoPictureInPicture !== undefined;
      await this.exitInternalVideoPictureInPicture();
      await this.pictureInPicture.exitAllModes();
      const viewer = this.viewerWindow;
      if (restoreInternalViewer && viewer && !viewer.isDestroyed()) {
        this.focusViewer();
        this.restoreOverlayAfterPictureInPicture();
      }
    } catch (error) {
      this.logger.error('PiP could not restore the viewer window.', error);
    } finally {
      this.restoringPictureInPicture = false;
    }
  }

  /** Sets the app locale. */
  setAppLocale(locale: AppLocale, systemLocale: string): void {
    this.appLocale = locale;
    this.systemLocale = systemLocale;
    this.appTitle = getAppMessages(locale, systemLocale).title;
    this.viewerWindow?.setTitle(this.appTitle);
    this.renderSiteTransitionSurface();
  }

  /** Toggles the app full screen. */
  toggleAppFullScreen(): void {
    const viewer = this.requireViewerWindow();
    viewer.setFullScreen(!viewer.isFullScreen());
  }

  /** Performs the reload viewer operation. */
  reloadViewer(): void {
    this.requireActiveViewerWebContents().reload();
  }

  /** Sets the app theme. */
  setAppTheme(theme: AppTheme): void {
    this.appTheme = theme;
    // Electron propagates this value to every current and future renderer as
    // the native prefers-color-scheme media query. Do not replace it with a
    // DevTools emulation override: a persistent override prevents renderers
    // from receiving subsequent native theme changes.
    nativeTheme.themeSource = theme;
    this.viewerWindow?.setBackgroundColor(this.getViewerSurfaceColor());
    this.siteView?.setBackgroundColor(this.getViewerSurfaceColor());
    this.renderSiteTransitionSurface();
  }

  /** Returns the native backing color shown between Provider documents. */
  private getViewerSurfaceColor(): string {
    return this.appTheme === 'light' ? '#f4f4f5' : '#09090b';
  }

  /** Tracks handoff timing, retaining the outgoing view until native replacement. */
  notifySiteTransition(state: SiteTransitionState): void {
    this.siteTransitionState = state;
    if (state.phase === 'loading') this.siteTransitionStartedAt = Date.now();
    if (state.phase === 'failed') this.siteView?.setVisible(false);
    const contents = this.siteView?.webContents;
    if (state.phase === 'loading' && contents && !contents.isDestroyed()) {
      contents.setAudioMuted(true);
    }
    this.logger.debug('Site transition lifecycle.', {
      /** Provider identifier only, never a credential-bearing navigation URL. */
      siteId: state.siteId,
      /** Lifecycle phase. */
      phase: state.phase,
      /** Total application-side transition time. */
      elapsedMs: Date.now() - this.siteTransitionStartedAt,
    });
    this.renderSiteTransitionSurface();
  }

  /** Updates only the persistent app-owned viewer document, without another load. */
  private renderSiteTransitionSurface(): void {
    const viewer = this.viewerWindow;
    const ready = this.siteTransitionSurfaceReady;
    if (!viewer || viewer.isDestroyed() || !ready) return;
    const revision = ++this.siteTransitionSurfaceRevision;
    const copy = getAppMessages(this.appLocale, this.systemLocale);
    const source = createUpdateSiteTransitionSurfaceScript(
      this.siteTransitionState,
      {
        /** Locale-backed failure title. */
        siteTransitionFailed: copy.siteTransitionFailed,
        /** Locale-backed retry guidance. */
        siteTransitionRecovery: copy.siteTransitionRecovery,
      },
      this.appLocale === 'system' ? this.systemLocale : this.appLocale,
      this.appTheme,
    );
    void ready.then((loaded) => {
      if (!loaded || viewer.isDestroyed() || revision !== this.siteTransitionSurfaceRevision) return;
      return viewer.webContents.executeJavaScript(source);
    }).catch((error: unknown) => {
      if (!viewer.isDestroyed()) this.logger.debug('Site transition feedback could not be updated.', error);
    });
  }

  /** Presents the active document at DOM readiness, not after slow subresources finish. */
  private revealActiveSiteView(contents: WebContents, reason: string): void {
    const view = this.siteView;
    const transition = this.siteTransitionState;
    if (!view || view.webContents !== contents || !this.siteViewAttached ||
        this.internalVideoVisible || contents.isDestroyed() ||
        transition?.phase === 'failed' ||
        (transition?.phase === 'loading' && transition.siteId !== this.siteViewSiteId) ||
        !contents.getURL() || contents.getURL() === 'about:blank') return;
    if (!view.getVisible()) {
      view.setVisible(true);
      contents.invalidate();
      this.logger.debug('Presented active site content.', {
        /** Application lifecycle event that made content presentable. */
        reason,
        /** Time to first presentable main-frame DOM. */
        elapsedMs: Date.now() - this.siteTransitionStartedAt,
      });
      if (!this.overlayVisible) contents.focus();
    }
  }

  /** Sets the internal video presentation. */
  setInternalVideoPresentation(webContentsId: number, value: unknown): boolean {
    const video = this.videoView;
    if (
      !this.internalVideoVisible ||
      !video ||
      video.webContents.isDestroyed() ||
      video.webContents.id !== webContentsId ||
      !value ||
      typeof value !== 'object'
    ) {
      return false;
    }
    const candidate = value as Partial<VideoPresentationState>;
    const width = normalizeVideoDimension(candidate.width);
    const height = normalizeVideoDimension(candidate.height);
    this.internalVideoPresentation = {
      ready: candidate.ready === true,
      width,
      height,
    };
    return true;
  }

  /** Toggles the internal video picture in picture. */
  private async toggleInternalVideoPictureInPicture() {
    if (this.internalVideoPictureInPicture) {
      await this.exitInternalVideoPictureInPicture();
      this.focusViewer();
      this.restoreOverlayAfterPictureInPicture();
      return {
        /** The status value. */
        status: 'exited' as const,
        /** The mode value. */
        mode: 'window' as const,
      };
    }
    if (!this.internalVideoPresentation.ready) {
      return {
        /** The status value. */
        status: 'no-video' as const,
        /** The mode value. */
        mode: 'window' as const,
      };
    }
    if (!this.prepareOverlayForPictureInPicture()) {
      return {
        /** The status value. */
        status: 'disabled' as const,
        /** The mode value. */
        mode: 'window' as const,
      };
    }

    const viewer = this.requireViewerWindow();
    const video = this.requireVideoView();
    const aspectRatio = this.internalVideoPresentation.width > 0 &&
        this.internalVideoPresentation.height > 0
      ? this.internalVideoPresentation.width / this.internalVideoPresentation.height
      : undefined;
    const portrait = typeof aspectRatio === 'number' && aspectRatio < 1;
    const preferred = resolvePictureInPictureSize(
      portrait ? this.pictureInPicturePortraitSize : this.pictureInPictureSize,
      aspectRatio,
      portrait ? 'portrait' : 'landscape',
    );
    const bounds = resolveInternalVideoPictureInPictureBounds(
      viewer.getBounds(), preferred, this.pictureInPicturePlacement,
    );
    const pip = new BrowserWindow({
      ...bounds,
      show: false,
      frame: false,
      roundedCorners: false,
      backgroundColor: '#050506',
      title: getLocaleMessages(this.appLocale, this.systemLocale).nativeDialogs.videoWindowTitle,
      skipTaskbar: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
    });
    pip.setMenu(null);
    pip.setMenuBarVisibility(false);
    pip.setMinimumSize(
      Math.min(PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.width, bounds.width),
      Math.min(PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.height, bounds.height),
    );
    pip.setAspectRatio(aspectRatio ?? 0);
    pip.on('resize', () => this.syncVideoViewBounds());
    pip.on('blur', () => this.scheduleInternalVideoPictureInPictureReassertion());
    pip.on('show', () => this.scheduleInternalVideoPictureInPictureReassertion());
    pip.on('close', (event) => {
      if (!this.disposing && this.internalVideoPictureInPicture?.window === pip) {
        event.preventDefault();
        void this.restorePictureInPicture();
      }
    });
    this.internalVideoPictureInPicture = { window: pip };
    this.suspendViewerAlwaysOnTopForPictureInPicture();
    if (process.platform === 'darwin') {
      this.prepareMacApplicationForInternalVideoPictureInPicture();
    }
    pip.setAlwaysOnTop(true, 'screen-saver');
    if (process.platform === 'darwin') {
      pip.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    try {
      video.webContents.send(IPC_CHANNELS.video.pictureInPictureChanged, true);
      await transferWebContentsView({
        sourceWindow: viewer,
        targetWindow: pip,
        view: video,
      });
      viewer.hide();
      this.startInternalVideoPictureInPicturePointerMonitor(pip);
      if (process.platform === 'darwin') {
        this.presentInternalVideoPictureInPicture(pip);
        this.scheduleInternalVideoPictureInPictureReassertion();
      } else {
        pip.show();
        pip.moveTop();
        pip.focus();
        video.webContents.focus();
      }
    } catch (error) {
      await this.exitInternalVideoPictureInPicture(false);
      throw error;
    }
    this.notifyPictureInPictureChanged({ status: 'entered', mode: 'window'
    });
    return {
      /** The status value. */
      status: 'entered' as const,
      /** The mode value. */
      mode: 'window' as const,
    };
  }

  /** Performs the exit internal video picture in picture operation. */
  private async exitInternalVideoPictureInPicture(notify = true): Promise<void> {
    const state = this.internalVideoPictureInPicture;
    if (!state) return;
    this.clearInternalVideoPictureInPictureReassertions();
    this.clearInternalVideoPictureInPicturePointerMonitor();
    const viewer = this.viewerWindow;
    const video = this.videoView;
    const pip = state.window;
    if (!pip.isDestroyed()) {
      const placement = captureInternalVideoPictureInPicturePlacement(pip);
      if (placement) await this.pictureInPicturePlacementRecorder?.(placement);
    }
    this.internalVideoPictureInPicture = undefined;
    if (video && !video.webContents.isDestroyed()) {
      video.webContents.send(IPC_CHANNELS.video.pictureInPictureChanged, false);
    }
    if (process.platform === 'darwin') {
      if (!pip.isDestroyed()) disableMacOSFullScreenAuxiliary(pip);
      app.setActivationPolicy('regular');
      await app.dock?.show();
    }
    if (viewer && !viewer.isDestroyed() && video &&
        !video.webContents.isDestroyed()) {
      viewer.show();
      await transferWebContentsView({
        sourceWindow: pip.isDestroyed() ? undefined : pip,
        targetWindow: viewer,
        view: video,
      });
      this.syncVideoViewBounds();
      video.setVisible(this.internalVideoVisible);
      if (this.overlayVisible) this.syncOverlayBounds();
    }
    if (!pip.isDestroyed()) pip.destroy();
    this.restoreViewerAlwaysOnTopAfterPictureInPicture();
    if (notify) {
      this.notifyPictureInPictureChanged({ status: 'exited', mode: 'window' });
    }
  }

  /** Performs the present internal video picture in picture operation. */
  private presentInternalVideoPictureInPicture(video: BrowserWindow): void {
    if (video.isDestroyed()) return;
    this.prepareMacApplicationForInternalVideoPictureInPicture();
    video.setAlwaysOnTop(true, 'screen-saver');
    video.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    enableMacOSFullScreenAuxiliary(video);
    // Keep the game active. Clicking the PiP can still activate it naturally.
    video.showInactive();
    video.moveTop();
  }

  /** Prepares the mac application for internal video picture in picture. */
  private prepareMacApplicationForInternalVideoPictureInPicture(): void {
    // AppKit's FullScreenAuxiliary behavior requires an accessory process.
    // The native bridge then adds the existing true fullscreen Space that
    // Electron can omit when Kawaikara originally launched as a Dock app.
    app.setActivationPolicy('accessory');
    app.dock?.hide();
  }

  /** Schedules the internal video picture in picture reassertion. */
  private scheduleInternalVideoPictureInPictureReassertion(): void {
    if (process.platform !== 'darwin' || !this.internalVideoPictureInPicture) {
      return;
    }
    this.clearInternalVideoPictureInPictureReassertions();
    for (const delay of [0, 250, 1_000]) {
      const timer = setTimeout(() => {
        this.internalVideoPictureInPictureReassertTimers.delete(timer);
        const pip = this.internalVideoPictureInPicture?.window;
        if (!pip || pip.isDestroyed()) return;
        this.presentInternalVideoPictureInPicture(pip);
      }, delay);
      this.internalVideoPictureInPictureReassertTimers.add(timer);
    }
  }

  /** Clears the internal video picture in picture reassertions. */
  private clearInternalVideoPictureInPictureReassertions(): void {
    for (const timer of this.internalVideoPictureInPictureReassertTimers) {
      clearTimeout(timer);
    }
    this.internalVideoPictureInPictureReassertTimers.clear();
  }

  /**
   * Tracks entry into the native PiP window. The full PiP surface is an
   * app-region drag target, so Chromium does not reliably emit DOM pointer
   * events outside the explicit no-drag controls on Windows.
   */
  private startInternalVideoPictureInPicturePointerMonitor(
    video: BrowserWindow,
  ): void {
    this.clearInternalVideoPictureInPicturePointerMonitor();
    this.internalVideoPictureInPictureVisibility = trackPictureInPictureVisibility(
      video,
      () => screen.getCursorScreenPoint(),
      () => this.internalVideoPictureInPicture?.window === video,
      (visible) => {
        const contents = this.videoView?.webContents;
        if (contents && !contents.isDestroyed()) contents.send(
          IPC_CHANNELS.video.pictureInPicturePointerChanged,
          visible,
        );
      },
    );
  }

  /** Stops native PiP cursor polling and clears the renderer hover state. */
  private clearInternalVideoPictureInPicturePointerMonitor(): void {
    this.internalVideoPictureInPictureVisibility?.dispose();
    this.internalVideoPictureInPictureVisibility = undefined;
  }

  /** Notifies the picture in picture changed. */
  private notifyPictureInPictureChanged(result: {
    /** The status value. */
    readonly status: 'entered' | 'exited';
    /** The mode value. */
    readonly mode: 'window';
  }
  ): void {
    const overlay = this.overlaySurface;
    if (overlay && !overlay.webContents.isDestroyed()) {
      overlay.webContents.send(
        IPC_CHANNELS.media.pictureInPictureChanged,
        result,
      );
    }
    this.pictureInPictureStateHandler?.(result.status === 'entered');
  }

  /** Determines whether the app full screen condition applies. */
  isAppFullScreen(): boolean {
    return !this.internalVideoPictureInPicture &&
      this.requireViewerWindow().isFullScreen();
  }

  /** Performs the exit app full screen operation. */
  exitAppFullScreen(): void {
    const viewer = this.requireViewerWindow();
    if (viewer.isFullScreen()) viewer.setFullScreen(false);
  }

  /** Notifies the development state changed. */
  notifyDevelopmentStateChanged(state: DevelopmentState): void {
    const overlay = this.overlaySurface;
    if (overlay && !overlay.webContents.isDestroyed()) {
      overlay.webContents.send(IPC_CHANNELS.development.stateChanged, state);
    }
  }

  /** Performs the go back operation. */
  goBack(): boolean {
    const navigation = this.requireActiveViewerWebContents().navigationHistory;
    if (!this.canNavigateHistory(-1)) return false;
    navigation.goToOffset(-1);
    return true;
  }

  /** Performs the go forward operation. */
  goForward(): boolean {
    const navigation = this.requireActiveViewerWebContents().navigationHistory;
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
  private canNavigateHistory(offset: -1 | 1): boolean {
    if (this.internalVideoVisible) return false;
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

  /** Sets the editing state. */
  setEditingState(webContentsId: number, editing: boolean): boolean {
    const viewerId = this.siteView?.webContents.id;
    const internalViewerId = this.videoView?.webContents.id;
    const overlayId = this.overlaySurface?.webContents.id;
    if (
      webContentsId !== viewerId &&
      webContentsId !== internalViewerId &&
      webContentsId !== overlayId
    ) {
      return false;
    }
    if (editing) {
      this.editingWebContentsIds.add(webContentsId);
    } else {
      this.editingWebContentsIds.delete(webContentsId);
    }
    return true;
  }

  /** Performs the show overlay operation. */
  showOverlay(): void {
    const overlay = this.requireOverlaySurface();
    this.overlayView = 'menu';
    this.overlayVisible = true;
    this.syncOverlayBounds();
    overlay.webContents.send(IPC_CHANNELS.overlay.showMenu);
    this.revealOverlay(overlay);
  }

  /** Performs the show preferences overlay operation. */
  showPreferencesOverlay(): void {
    const overlay = this.requireOverlaySurface();
    this.overlayView = 'preference';
    this.overlayVisible = true;
    this.syncOverlayBounds();
    overlay.webContents.send(IPC_CHANNELS.overlay.showPreferences);
    this.revealOverlay(overlay);
  }

  /** Performs the show update overlay operation. */
  showUpdateOverlay(state: ApplicationUpdatePanelState): void {
    const overlay = this.requireOverlaySurface();
    this.overlayView = 'update';
    this.overlayVisible = true;
    this.syncOverlayBounds();
    overlay.webContents.send(IPC_CHANNELS.overlay.showUpdate, state);
    this.revealOverlay(overlay);
  }

  /** Updates the update overlay. */
  updateUpdateOverlay(state: ApplicationUpdatePanelState): void {
    const overlay = this.overlaySurface;
    if (!overlay || overlay.webContents.isDestroyed()) return;
    overlay.webContents.send(
      IPC_CHANNELS.application.updateStateChanged,
      state,
    );
  }

  /** Performs the hide overlay operation. */
  hideOverlay(): void {
    this.overlayVisible = false;
    const overlay = this.overlaySurface;
    if (overlay && !overlay.webContents.isDestroyed()) {
      this.clearOverlayRevealTimer();
      overlay.webContents.send(IPC_CHANNELS.overlay.hidden);
      overlay.setVisible(false);
      this.syncOverlayBounds();
    }
    this.viewerWindow?.focus();
    if (this.internalVideoVisible) {
      this.videoView?.webContents.focus();
    } else if (this.siteView && !this.siteView.webContents.isDestroyed()) {
      this.siteView.webContents.focus();
    }
  }

  /** Prepares the overlay for picture in picture. */
  private prepareOverlayForPictureInPicture(): boolean {
    if (this.overlayVisible && this.overlayView !== 'menu') return false;
    this.restoreMenuAfterPictureInPicture =
      this.overlayVisible && this.overlayView === 'menu';
    if (this.restoreMenuAfterPictureInPicture) this.hideOverlay();
    return true;
  }

  /** Restores the overlay after picture in picture. */
  private restoreOverlayAfterPictureInPicture(): void {
    if (!this.restoreMenuAfterPictureInPicture) return;
    this.restoreMenuAfterPictureInPicture = false;
    this.showOverlay();
  }

  /** Toggles the overlay. */
  toggleOverlay(): void {
    if (this.overlayVisible) {
      const overlay = this.requireOverlaySurface();
      overlay.webContents.send(IPC_CHANNELS.overlay.requestClose);
    } else {
      this.showOverlay();
    }
  }

  /** Performs the focus viewer operation. */
  focusViewer(): void {
    const viewer = this.requireViewerWindow();
    this.hideOverlay();
    if (process.platform === 'darwin') {
      app.setActivationPolicy('regular');
      void app.dock?.show();
    }
    if (viewer.isMinimized()) {
      viewer.restore();
    }
    viewer.show();
    this.syncSiteViewBounds();
    this.syncVideoViewBounds();
    if (process.platform === 'darwin') app.focus({ steal: true
    });
    viewer.moveTop();
    viewer.focus();
    if (this.internalVideoVisible) {
      this.videoView?.webContents.focus();
    } else this.siteView?.webContents.focus();
  }

  /** Performs the activate site view operation. */
  private async activateSiteView(
    runtime: SiteRuntimeProfile,
  ): Promise<{
    /** The site session value. */
    readonly siteSession: Session;
    /** The web contents value. */
    readonly webContents: WebContents;
  }> {
    const viewerWindow = this.requireViewerWindow();
    if (this.internalVideoVisible) {
      await this.exitInternalVideoPictureInPicture();
      this.internalVideoVisible = false;
      this.internalVideoPresentation = { ready: false, width: 0, height: 0
      };
      const video = this.videoView;
      if (video && !video.webContents.isDestroyed()) {
        this.setInternalVideoSiteVisibility(video, false);
      }
    }
    if (this.siteView && !this.siteView.webContents.isDestroyed()) {
      await this.pictureInPicture.exitAllModes();
    }
    // Wait only for authentication state to settle, not Chrome process exit or
    // locked temporary-profile removal. Provider teardown is already retiring.
    await this.cancelExternalLogin(false);
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
    siteView.setBackgroundColor(this.getViewerSurfaceColor());
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
      (message) => message.includes('[Kawaikara/') || message.startsWith('[video-effects]'),
      runtime.siteId,
    );
    this.attachSiteWebContents(siteView.webContents, siteSession);
    viewerWindow.contentView.addChildView(siteView);
    this.siteViewAttached = true;
    this.syncSiteViewBounds();
    if (this.overlayVisible) {
      this.syncOverlayBounds();
      this.overlaySurface?.webContents.focus();
    } else {
      siteView.webContents.focus();
    }
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
  private attachSiteWebContents(
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
        this.logger.debug(`Refreshed the site compositor surface (${reason}).`);
      }, 0);
    };
    webContents.on('dom-ready', () => {
      this.revealActiveSiteView(webContents, 'dom-ready');
      this.installRemoteThemeBridge(webContents);
      void webContents
        .insertCSS(REMOTE_SCROLLBAR_CSS, { cssOrigin: 'user'
        })
        .catch((error: unknown) => {
          this.logger.debug('The site scrollbar theme could not be applied.', error);
        });
      refreshSiteSurface('dom-ready');
    });
    webContents.on('did-finish-load', () => refreshSiteSurface('did-finish-load'));
    webContents.on('media-started-playing', () =>
      refreshSiteSurface('media-started-playing'),
    );
    webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return;
        this.logger.warn('Site main-frame load failed.', {
          errorCode,
          errorDescription,
          url: validatedURL,
        });
      },
    );
    webContents.on('render-process-gone', (_event, details) => {
      this.logger.error('Site renderer process exited.', details);
      if (details.reason === 'clean-exit' || webContents.isDestroyed()) return;
      setTimeout(() => {
        if (!webContents.isDestroyed()) webContents.reload();
      }, 500);
    });
    webContents.on('before-input-event', (event, input) => {
      if (this.siteView?.webContents !== webContents) return;
      const editing = this.editingWebContentsIds.has(webContentsId);
      if (handleNativeEditingShortcut(webContents, input, editing)) {
        event.preventDefault();
        return;
      }
      if (this.shortcutHandler?.(input, editing)) event.preventDefault();
    });
    /** Performs the guard navigation operation. */
    const guardNavigation = (event: Electron.Event, url: string): void => {
      if (this.siteView?.webContents !== webContents) {
        event.preventDefault();
        return;
      }
      const action = this.parseSiteAction(url);
      if (action !== undefined) {
        event.preventDefault();
        this.dispatchSiteAction(action);
        return;
      }
      if (this.navigationGuard && !this.navigationGuard(url)) {
        event.preventDefault();
        this.logger.debug(`Blocked guarded site navigation: ${url}`);
      }
    };
    webContents.on('will-navigate', guardNavigation);
    webContents.on('will-redirect', guardNavigation);
    webContents.on('will-frame-navigate', (details) => {
      if (this.siteView?.webContents !== webContents) return;
      // Provider action URLs may originate in a cross-origin media iframe
      // (for example CHZZK's m.naver.com Shorts carousel). Only intercept the
      // application-owned scheme here; ordinary subframe navigation remains
      // outside the main-frame navigation guard.
      const action = this.parseSiteAction(details.url);
      if (action === undefined) return;
      details.preventDefault();
      this.dispatchSiteAction(action);
    });
    webContents.on('did-start-loading', () => {
      this.editingWebContentsIds.delete(webContentsId);
    });
    /** Performs the finish picture in picture navigation operation. */
    const finishPictureInPictureNavigation = (url: string): void => {
      if (this.siteView?.webContents !== webContents) return;
      // Decide from the committed route, not did-start-navigation. CHZZK can
      // briefly announce a non-video/intermediate URL while its Shorts router
      // replaces the current clip. Exiting at that point drops PiP even though
      // the committed destination is another Provider-approved video.
      if (
        this.pictureInPicture.isActive() &&
        this.pictureInPictureGuard?.(url) !== true
      ) {
        void this.pictureInPicture.exitAllModes();
      }
    };
    webContents.on('did-navigate', (_event, url) => {
      finishPictureInPictureNavigation(url);
    });
    webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) finishPictureInPictureNavigation(url);
    });
    webContents.on('page-title-updated', (event) => {
      event.preventDefault();
      if (this.siteView?.webContents === webContents) this.viewerWindow?.setTitle(this.appTitle);
    });
    webContents.on('destroyed', () => {
      this.editingWebContentsIds.delete(webContentsId);
    });
    webContents.on('devtools-opened', () => {
      this.keepSiteDevToolsOpen = true;
      this.configureDevToolsWebContents(webContents);
    });
    webContents.on('devtools-closed', () => {
      const currentSiteWebContentsId = this.siteView?.webContents.id;
      if (currentSiteWebContentsId === webContentsId) {
        this.keepSiteDevToolsOpen = false;
      }
    });

    webContents.setWindowOpenHandler(({ url }) => {
      if (this.siteView?.webContents !== webContents) return { action: 'deny' };
      const action = this.parseSiteAction(url);
      if (action !== undefined) {
        this.dispatchSiteAction(action);
        return { action: 'deny'
        };
      }
      if (this.navigationGuard && !this.navigationGuard(url)) {
        this.logger.debug(`Blocked guarded site window open: ${url}`);
        return { action: 'deny'
        };
      }

      const policy = this.newWindowPolicyResolver?.(url) ?? 'viewer';
      switch (policy) {
        case 'external':
          void openInDefaultBrowser(url).catch((error: unknown) => {
            this.logger.error(`Failed to open ${url} in the default browser.`, error);
          });
          return { action: 'deny'
          };
        case 'viewer':
          void webContents.loadURL(url).catch((error: unknown) => {
            this.logger.error(`Failed to open ${url} in the site viewer.`, error);
          });
          return { action: 'deny'
          };
        case 'deny':
          return { action: 'deny'
          };
        case 'popup':
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              parent: this.viewerWindow,
              autoHideMenuBar: true,
              backgroundColor: '#ffffff',
              webPreferences: {
                session: siteSession,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
              },
            },
          };
        case 'default':
          return { action: 'allow'
          };
      }
    });

    webContents.on('did-create-window', (popupWindow) => {
      if (this.siteView?.webContents !== webContents) {
        popupWindow.destroy();
        return;
      }
      this.sitePopupWindows.add(popupWindow);
      // A site-specific browser UA must also be visible to popup JavaScript.
      // Session request interception covers the initial navigation headers.
      popupWindow.webContents.setUserAgent(webContents.getUserAgent());
      popupWindow.webContents.on('dom-ready', () => {
        this.installRemoteThemeBridge(popupWindow.webContents);
      });
      this.installRemoteThemeBridge(popupWindow.webContents);
      popupWindow.setMenuBarVisibility(false);
      popupWindow.on('closed', () => {
        this.sitePopupWindows.delete(popupWindow);
      });
    });

    if (this.openDevToolsOnInitialSite) {
      this.openDevToolsOnInitialSite = false;
      this.keepSiteDevToolsOpen = true;
    }
    if (this.keepSiteDevToolsOpen) {
      // A site switch replaces the WebContentsView. Reattach DevTools to the
      // replacement instead of making developers reopen it for every Provider.
      queueMicrotask(() => this.openActiveSiteDevTools(false));
    }
  }

  /** Opens the active site dev tools. */
  private openActiveSiteDevTools(activate: boolean): void {
    const webContents = this.getActiveViewerWebContents();
    if (
      !webContents ||
      webContents.isDestroyed() ||
      webContents.isDevToolsOpened()
    ) {
      return;
    }
    webContents.openDevTools({ mode: this.devToolsMode, activate
    });
  }

  /** Performs the configure dev tools web contents operation. */
  private configureDevToolsWebContents(
    inspectedContents: WebContents,
    windowLookupAttempt = 0,
  ): void {
    const devToolsContents = inspectedContents.devToolsWebContents;
    if (!devToolsContents || devToolsContents.isDestroyed()) return;
    if (!this.configuredDevToolsContents.has(devToolsContents)) {
      this.configuredDevToolsContents.add(devToolsContents);
      // Menu.setApplicationMenu(null) removes Electron's default edit menu,
      // including the accelerator that DevTools normally inherits. Restore
      // native editing commands directly on the DevTools WebContents.
      devToolsContents.on('before-input-event', (event, input) => {
        if (handleNativeEditingShortcut(devToolsContents, input, true)) {
          event.preventDefault();
        }
      });
    }

    if (this.devToolsMode !== 'detach') return;
    const devToolsWindow = BrowserWindow.fromWebContents(devToolsContents);
    if (!devToolsWindow) {
      // On macOS the devtools-opened event can precede registration of the
      // detached native window by one or two event-loop turns.
      if (windowLookupAttempt < 8) {
        setImmediate(() => {
          if (!inspectedContents.isDestroyed()) {
            this.configureDevToolsWebContents(
              inspectedContents,
              windowLookupAttempt + 1,
            );
          }
        });
      }
      return;
    }
    if (devToolsWindow === this.viewerWindow) return;
    if (!this.configuredDevToolsWindows.has(devToolsWindow)) {
      this.configuredDevToolsWindows.add(devToolsWindow);
      /** Performs the remember bounds operation. */
      const rememberBounds = () => {
        if (!devToolsWindow.isDestroyed()) {
          this.detachedDevToolsBounds = devToolsWindow.getBounds();
        }
      };
      devToolsWindow.on('move', rememberBounds);
      devToolsWindow.on('resize', rememberBounds);
    }
    const bounds = this.detachedDevToolsBounds;
    if (bounds) {
      // DevTools creates its native window asynchronously. Applying the saved
      // rectangle on the next turn keeps its exact monitor and position when
      // a site switch replaces the inspected WebContents.
      setImmediate(() => {
        if (!devToolsWindow.isDestroyed()) devToolsWindow.setBounds(bounds, false);
      });
    }
  }

  /** Installs the remote theme bridge. */
  private installRemoteThemeBridge(webContents: WebContents): void {
    if (webContents.isDestroyed()) return;
    void webContents
      .executeJavaScript(createRemoteThemeBridgeInjectionScript(), true)
      .catch((error: unknown) => {
        this.logger.debug('The live site theme bridge could not be installed.', error);
      });
  }

  /** Performs the configure site session operation. */
  private configureSiteSession(siteSession: Session): void {
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
      let requestHeaders = this.requestHeadersTransformer?.({
        url: details.url,
        method: details.method,
        requestHeaders: details.requestHeaders,
      }) ?? details.requestHeaders;
      const identity = this.siteBrowserIdentity;
      if (
        identity && /^https:\/\//i.test(details.url) &&
        (!identity.requestHosts?.length ||
          matchesSiteUrlHost(details.url, identity.requestHosts))
      ) {
        requestHeaders = { ...requestHeaders
        };
        setRequestHeader(requestHeaders, 'User-Agent', identity.userAgent);
        if (identity.clientHints) {
          setRequestHeader(requestHeaders, 'Sec-Ch-Ua', identity.clientHints);
        }
      }
      callback({ requestHeaders
      });
    });
  }

  /** Retired views/profiles cannot inherit the successor's request policy or UA. */
  private isActiveSiteRequest(siteSession: Session, webContentsId: number | undefined): boolean {
    const current = this.siteView?.webContents;
    if (!current || current.isDestroyed() || current.session !== siteSession) return false;
    // OAuth popup navigation can begin before did-create-window registers it.
    // Keep the Session's existing policy for live popups/workers, but not a
    // captured outgoing view whose requests arrive after the native handoff.
    return webContentsId === undefined || webContentsId < 0 ||
      !this.retiredSiteWebContentsIds.has(webContentsId);
  }

  /** Performs the destroy site view operation. */
  private destroySiteView(): void {
    const siteView = this.siteView;
    this.siteView = undefined;
    this.siteViewSiteId = undefined;
    if (!siteView) return;
    const webContentsId = siteView.webContents.id;
    this.retiredSiteWebContentsIds.add(webContentsId);
    if (siteView.webContents.isDevToolsOpened()) {
      this.keepSiteDevToolsOpen = true;
      const devToolsContents = siteView.webContents.devToolsWebContents;
      const devToolsWindow = devToolsContents && !devToolsContents.isDestroyed()
        ? BrowserWindow.fromWebContents(devToolsContents)
        : null;
      if (
        this.devToolsMode === 'detach' &&
        devToolsWindow &&
        devToolsWindow !== this.viewerWindow &&
        !devToolsWindow.isDestroyed()
      ) {
        this.detachedDevToolsBounds = devToolsWindow.getBounds();
      }
    }
    this.editingWebContentsIds.delete(webContentsId);
    const viewerWindow = this.viewerWindow;
    if (viewerWindow && !viewerWindow.isDestroyed() && this.siteViewAttached) {
      viewerWindow.contentView.removeChildView(siteView);
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
  private requireCurrentSiteContext(webContents: WebContents): void {
    if (webContents.isDestroyed() || this.siteView?.webContents !== webContents) {
      throw new Error('The site WebContents is no longer active.');
    }
  }

  /** Creates the site viewer. */
  private createSiteViewer(
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
          throw new Error('This Provider does not have the navigation permission.');
        }
        const contents = getWebContents();
        await this.prepareViewerTransition(contents);
        getWebContents();
        this.currentVideoOpenRequest = null;
        await loadURLWithNavigationRecovery(contents, url);
        this.revealActiveSiteView(contents, 'load-complete');
        // A Provider load establishes a new site boundary. Chromium otherwise
        // keeps the previous Provider's document in this shared WebContents.
        contents.navigationHistory.clear();
      },
      /** The load internal view value. */
      loadInternalView: async (viewId) => {
        if (!permissions.has('internal-view')) {
          throw new Error('This Provider does not have the internal-view permission.');
        }
        if (viewId !== 'video') {
          throw new Error(`Unknown internal view: ${viewId}`);
        }
        const contents = getWebContents();
        await this.prepareViewerTransition(contents);
        getWebContents();
        const viewer = this.requireViewerWindow();
        const siteView = this.requireSiteView();
        if (this.siteViewAttached) {
          viewer.contentView.removeChildView(siteView);
          this.siteViewAttached = false;
        }
        this.internalVideoVisible = true;
        this.internalVideoPresentation = { ready: false, width: 0, height: 0
        };
        // The Video renderer remains alive and paused while another Provider
        // is active. Only explicit open actions should reload its source. A
        // plain return to Video must preserve the existing mpv session and
        // playback position instead of reopening and auto-playing the file.
        const existingVideo = Boolean(
          this.videoView && !this.videoView.webContents.isDestroyed(),
        );
        const request = this.pendingVideoOpenRequest ??
          (!existingVideo ? this.lastLocalVideoOpenRequest : undefined);
        this.pendingVideoOpenRequest = undefined;
        if (request) this.currentVideoOpenRequest = request;
        else if (!existingVideo) this.currentVideoOpenRequest = null;
        const video = await this.ensureVideoView();
        this.syncVideoViewBounds();
        this.setInternalVideoSiteVisibility(video, true);
        if (this.overlayVisible) this.syncOverlayBounds();
        if (existingVideo && request) {
          video.webContents.send(
            IPC_CHANNELS.video.openRequestChanged,
            request,
          );
        }
        video.webContents.focus();
      },
    };
  }

  /** Performs the use site browser identity operation. */
  private useSiteBrowserIdentity(
    webContents: WebContents,
    options: SiteBrowserIdentityOptions,
  ): Disposable {
    this.requireCurrentSiteContext(webContents);
    if (options.requestHosts?.some((host) =>
      !/^[a-z0-9.-]+$/i.test(host) || host.startsWith('.') || host.endsWith('.'),
    )) {
      throw new Error('Browser identity contains an invalid request host.');
    }
    const defaultUserAgent = webContents.getUserAgent();
    const userAgent = options.userAgent === 'chromium'
      ? createChromiumUserAgent(defaultUserAgent)
      : options.userAgent.trim();
    if (!userAgent || /[\r\n]/.test(userAgent)) {
      throw new Error('Browser identity contains an invalid user agent.');
    }
    const clientHints = options.clientHints === 'auto'
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
        if (!webContents.isDestroyed()) webContents.setUserAgent(defaultUserAgent);
      },
    };
  }

  /** Prepares the viewer transition. */
  private async prepareViewerTransition(webContents: WebContents): Promise<void> {
    this.requireCurrentSiteContext(webContents);
    await this.exitInternalVideoPictureInPicture();
    this.requireCurrentSiteContext(webContents);
    await this.pictureInPicture.exitAllModes();
    this.requireCurrentSiteContext(webContents);
    this.closeSitePopups();
    await prepareCurrentDocumentForNavigation(webContents);
  }

  /** Runs the external login. */
  private async runExternalLogin(
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
              this.appLocale,
              this.systemLocale,
              options.siteTitle,
              this.appTheme,
            ),
          ),
        },
      },
    );
    if (generation !== this.externalLoginGeneration || webContents.isDestroyed() ||
        this.siteView?.webContents !== webContents) return 'cancelled';
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
          this.logger.error(`Failed to restore ${returnUrl} after external login.`, error);
        });
      }
    }
  }

  /** Determines whether the cel external login condition applies. */
  private async cancelExternalLogin(waitForCleanup = true): Promise<void> {
    ++this.externalLoginGeneration;
    if (waitForCleanup) await this.externalBrowser.close();
    else await this.externalBrowser.cancelLogin();
  }

  /** Performs the sync site view bounds operation. */
  private syncSiteViewBounds(): void {
    if (
      !this.viewerWindow ||
      !this.siteView ||
      !this.siteViewAttached ||
      this.pictureInPicture.isActive()
    ) {
      return;
    }
    const [width, height] = this.viewerWindow.getContentSize();
    this.siteView.setBounds({ x: 0, y: 0, width, height
    });
  }

  /** Re-presents the active Chromium surface after native window activation. */
  private refreshActiveContentSurface(reason: string): void {
    setTimeout(() => {
      const viewer = this.viewerWindow;
      if (!viewer || viewer.isDestroyed() || !viewer.isVisible()) return;
      this.syncSiteViewBounds();
      this.syncVideoViewBounds();
      viewer.webContents.invalidate();

      if (this.internalVideoVisible) {
        const video = this.videoView;
        if (video && !video.webContents.isDestroyed() && video.getVisible()) {
          video.webContents.invalidate();
        }
      } else {
        const siteView = this.siteView;
        if (
          this.siteViewAttached &&
          siteView &&
          !siteView.webContents.isDestroyed() &&
          siteView.getVisible()
        ) {
          // A WebContentsView can lose its compositor surface while its native
          // parent is occluded by an exclusive fullscreen window. Reasserting
          // visibility and invalidating it restores the existing document
          // without reloading the site or restarting media.
          siteView.setVisible(true);
          siteView.webContents.invalidate();
        }
      }
      this.logger.debug(`Refreshed the active compositor surface (${reason}).`);
    }, 0);
  }

  /** Routes physical browser commands to folders, never to video.html history. */
  private routeVideoDirectoryNavigation(command: string): void {
    if (command !== 'browser-backward' && command !== 'browser-forward') return;
    const video = this.videoView;
    if (!this.internalVideoVisible || this.internalVideoPictureInPicture ||
        this.overlayVisible || !video || video.webContents.isDestroyed()) return;
    video.webContents.send(
      IPC_CHANNELS.video.directoryNavigationRequested,
      command === 'browser-backward' ? 'back' : 'forward',
    );
  }

  /** Sizes the retained Video renderer in its current native host. */
  private syncVideoViewBounds(): void {
    const video = this.videoView;
    if (!video || video.webContents.isDestroyed()) return;
    const host = this.internalVideoPictureInPicture?.window ?? this.viewerWindow;
    if (!host || host.isDestroyed()) return;
    const [width, height] = host.getContentSize();
    video.setBounds({ x: 0, y: 0, width, height });
  }

  /** Connects the Video view to the unmodified libmpv service. */
  private attachMpvVideoView(video: WebContentsView): void {
    const host = createMpvViewHost(video);
    this.mpv.attachWindow(host);
    this.mpvVideoHosts.set(video, host);
  }

  /** Releases a Video renderer from the libmpv service. */
  private async detachMpvVideoView(video: WebContentsView): Promise<void> {
    const host = this.mpvVideoHosts.get(video);
    if (!host) return;
    try {
      await this.mpv.detachWindow(host);
    } finally {
      this.mpvVideoHosts.delete(video);
    }
  }

  /** Creates one persistent Video renderer without creating a native window. */
  private ensureVideoView(): Promise<WebContentsView> {
    const existing = this.videoView;
    if (existing && !existing.webContents.isDestroyed()) return Promise.resolve(existing);
    if (this.videoViewLoading) return this.videoViewLoading;

    const viewer = this.requireViewerWindow();
    const video = new WebContentsView({
      webPreferences: {
        preload: path.resolve(__dirname, '../preload/viewer.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        ...(this.videoSoftwareRenderer
          ? { disableBlinkFeatures: 'WebGPU' }
          : {}),
        // electron-mpv-video exposes its renderer bridge from this preload.
        sandbox: false,
      },
    });
    video.setBackgroundColor('#050506');
    video.setVisible(false);
    viewer.contentView.addChildView(video);
    this.videoView = video;
    this.syncVideoViewBounds();
    this.readyVideoRendererWebContentsId = undefined;
    this.logging.attachRenderer(video.webContents, 'rendererVideo');
    this.attachMpvVideoView(video);
    const webContentsId = video.webContents.id;
    video.webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(webContentsId);
      if (handleNativeEditingShortcut(video.webContents, input, editing)) {
        event.preventDefault();
        return;
      }
      if (this.handleInternalVideoShortcutFromHost(input, editing)) {
        event.preventDefault();
        return;
      }
      if (this.shortcutHandler?.(input, editing)) event.preventDefault();
    });
    video.webContents.on('did-start-loading', () => {
      this.editingWebContentsIds.delete(webContentsId);
    });
    video.webContents.on('page-title-updated', (event) => event.preventDefault());
    video.webContents.on('destroyed', () => {
      this.clearVideoRendererInitializationWatchdog(webContentsId);
      if (this.readyVideoRendererWebContentsId === webContentsId) {
        this.readyVideoRendererWebContentsId = undefined;
      }
      this.editingWebContentsIds.delete(webContentsId);
      if (this.videoView === video) {
        this.videoView = undefined;
        this.internalVideoVisible = false;
        this.internalVideoPresentation = { ready: false, width: 0, height: 0 };
      }
    });

    const loading = video.webContents
      .loadFile(path.resolve(__dirname, '../renderer/video.html'))
      .then(() => {
        this.startVideoRendererInitializationWatchdog(video);
        return video;
      })
      .catch(async (error: unknown) => {
        if (!video.webContents.isDestroyed()) {
          await this.detachMpvVideoView(video).catch(() => undefined);
          viewer.contentView.removeChildView(video);
          video.webContents.close();
        }
        if (this.videoView === video) this.videoView = undefined;
        throw error;
      })
      .finally(() => {
        if (this.videoViewLoading === loading) this.videoViewLoading = undefined;
      });
    this.videoViewLoading = loading;
    return loading;
  }

  /** Starts a Main-process watchdog for a potentially frozen WebGPU renderer. */
  private startVideoRendererInitializationWatchdog(video: WebContentsView): void {
    const webContentsId = video.webContents.id;
    this.clearVideoRendererInitializationWatchdog();
    if (
      this.videoSoftwareRenderer ||
      !this.getVideoPlaybackCapabilities().nativeBackendAvailable ||
      this.readyVideoRendererWebContentsId === webContentsId
    ) {
      return;
    }
    this.videoRendererInitializationWebContentsId = webContentsId;
    this.videoRendererInitializationTimer = setTimeout(() => {
      this.videoRendererInitializationTimer = undefined;
      this.videoRendererInitializationWebContentsId = undefined;
      if (
        video.webContents.isDestroyed() ||
        this.videoView !== video ||
        this.readyVideoRendererWebContentsId === webContentsId
      ) {
        return;
      }
      this.logger.warn(
        'The Video renderer stopped responding during shared-texture initialization; switching to the libmpv WebGL renderer.',
      );
      void this.recoverVideoPlaybackRenderer(webContentsId).catch(
        (error: unknown) => {
          this.logger.error('Failed to recover the Video playback renderer.', error);
        },
      );
    }, VIDEO_RENDERER_INITIALIZATION_TIMEOUT_MS);
  }

  /** Clears the Main-process Video renderer initialization watchdog. */
  private clearVideoRendererInitializationWatchdog(
    webContentsId?: number,
  ): void {
    if (
      webContentsId !== undefined &&
      this.videoRendererInitializationWebContentsId !== webContentsId
    ) {
      return;
    }
    if (this.videoRendererInitializationTimer !== undefined) {
      clearTimeout(this.videoRendererInitializationTimer);
      this.videoRendererInitializationTimer = undefined;
    }
    this.videoRendererInitializationWebContentsId = undefined;
  }

  /** Performs the sync overlay bounds operation. */
  private syncOverlayBounds(): void {
    if (!this.viewerWindow || !this.overlaySurface) {
      return;
    }

    const parent = this.viewerWindow;
    if (this.overlayVisible) {
      // Site changes can attach a new view after the retained overlay.
      parent.contentView.addChildView(this.overlaySurface);
    }
    const [width, height] = parent.getContentSize();
    const bounds: Rectangle = {
      x: 0,
      y: 0,
      width,
      height,
    };
    this.overlaySurface.setBounds(bounds);
  }

  /** Performs the reveal overlay operation. */
  private revealOverlay(overlay: WebContentsView): void {
    this.clearOverlayRevealTimer();
    if (overlay.getVisible()) {
      this.viewerWindow?.focus();
      overlay.webContents.focus();
      return;
    }

    // The renderer stays alive while hidden. Give React/Motion two frames to
    // commit the off-screen entry pose before exposing the view, so a
    // completed menu frame cannot flash during a site navigation.
    this.overlayRevealTimer = setTimeout(() => {
      this.overlayRevealTimer = undefined;
      if (!this.overlayVisible || overlay.webContents.isDestroyed()) return;
      overlay.setVisible(true);
      this.viewerWindow?.focus();
      overlay.webContents.focus();
    }, 34);
  }

  /** Clears the overlay reveal timer. */
  private clearOverlayRevealTimer(): void {
    if (this.overlayRevealTimer === undefined) return;
    clearTimeout(this.overlayRevealTimer);
    this.overlayRevealTimer = undefined;
  }

  /** Closes the site popups. */
  private closeSitePopups(): void {
    for (const popupWindow of this.sitePopupWindows) {
      if (!popupWindow.isDestroyed()) {
        popupWindow.close();
      }
    }
    this.sitePopupWindows.clear();
  }

  /** Parses the site action. */
  private parseSiteAction(url: string): string | undefined {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'kawaikara-action:' || parsed.hostname !== 'invoke') {
        return undefined;
      }
      const action = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      return action || undefined;
    } catch {
      return undefined;
    }
  }

  /** Performs the require viewer window operation. */
  private requireViewerWindow(): BrowserWindow {
    if (!this.viewerWindow || this.viewerWindow.isDestroyed()) {
      throw new Error('The site viewer window has not been created.');
    }
    return this.viewerWindow;
  }

  /** Returns the active viewer web contents. */
  private getActiveViewerWebContents(): WebContents | undefined {
    if (this.internalVideoVisible) return this.videoView?.webContents;
    return this.siteView?.webContents;
  }

  /** Performs the require active viewer web contents operation. */
  private requireActiveViewerWebContents(): WebContents {
    const webContents = this.getActiveViewerWebContents();
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('The active viewer WebContents has not been created.');
    }
    return webContents;
  }

  /** Performs the require site web contents operation. */
  private requireSiteWebContents(): WebContents {
    return this.requireSiteView().webContents;
  }

  /** Returns the retained Video view. */
  private requireVideoView(): WebContentsView {
    const video = this.videoView;
    if (!video || video.webContents.isDestroyed()) {
      throw new Error('The Video view has not been created.');
    }
    return video;
  }

  /** Performs the require site view operation. */
  private requireSiteView(): WebContentsView {
    const siteView = this.siteView;
    const webContents = siteView?.webContents;
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('The site viewer WebContentsView has not been created.');
    }
    return siteView;
  }

  /** Gives keyboard focus back to the persistent internal Video child. */
  private focusInternalVideoView(): void {
    const video = this.videoView;
    if (
      !this.internalVideoVisible ||
      this.overlayVisible ||
      !video ||
      video.webContents.isDestroyed() ||
      !video.getVisible()
    ) {
      return;
    }
    video.webContents.focus();
  }

  /** Routes Video-owned keys even when Windows has focused the parent host. */
  private handleInternalVideoShortcutFromHost(
    input: Input,
    editing: boolean,
  ): boolean {
    if (
      !this.internalVideoVisible ||
      input.type !== 'keyDown' ||
      input.isAutoRepeat ||
      input.isComposing ||
      input.control ||
      input.meta ||
      input.alt ||
      input.shift
    ) {
      return false;
    }

    const key = input.key.toLowerCase();
    if (key === 'tab') {
      // PiP deliberately owns no Menu. In the full Video view, Tab opens it.
      if (!this.internalVideoPictureInPicture) this.toggleOverlay();
      return true;
    }
    if (
      !editing &&
      (input.code === 'Space' || key === ' ' || key === 'space')
    ) {
      const video = this.videoView;
      if (video && !video.webContents.isDestroyed()) {
        video.webContents.send(IPC_CHANNELS.video.playbackToggleRequested);
      }
      return true;
    }
    return false;
  }

  /** Shows the retained Video renderer within the Viewer window. */
  private setInternalVideoSiteVisibility(
    video: WebContentsView,
    visible: boolean,
  ): void {
    video.webContents.send(IPC_CHANNELS.video.visibilityChanged, visible);
    video.setVisible(visible);
    if (visible) {
      this.viewerWindow?.contentView.addChildView(video);
      this.syncVideoViewBounds();
      if (this.overlayVisible) this.syncOverlayBounds();
    }
  }

  /** Returns the retained app-owned overlay view. */
  private requireOverlaySurface(): WebContentsView {
    if (!this.overlaySurface || this.overlaySurface.webContents.isDestroyed()) {
      throw new Error('The renderer overlay view has not been created.');
    }
    return this.overlaySurface;
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
