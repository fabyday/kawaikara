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
import { openInDefaultBrowser } from '../Functional/DefaultBrowser';
import { createSitePagePipeline } from '../Functional/SitePagePipeline';
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
  /** The video window value. */
  private videoWindow?: BrowserWindow;
  /** The video window loading value. */
  private videoWindowLoading?: Promise<BrowserWindow>;
  /** The video software renderer value. */
  private videoSoftwareRenderer = false;
  /** The video renderer recovery value. */
  private videoRendererRecovery?: Promise<boolean>;
  /** The overlay window value. */
  private overlayWindow?: BrowserWindow;
  /** The site view value. */
  private siteView?: WebContentsView;
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
  /** The picture in picture placement value. */
  private pictureInPicturePlacement = DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;
  /** The picture in picture portrait size value. */
  private pictureInPicturePortraitSize =
    DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE;
  /** The picture in picture size value. */
  private pictureInPictureSize = DEFAULT_PICTURE_IN_PICTURE_SIZE;
  /** The configured site sessions value. */
  private readonly configuredSiteSessions = new WeakSet<Session>();
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
  /** The overlay reveal timer value. */
  private overlayRevealTimer?: ReturnType<typeof setTimeout>;

  /** Creates an instance of WindowManager. */
  constructor(
    externalBrowser: ExternalBrowserManager,
    createPictureInPicture: PictureInPictureManagerFactory,
    /** The logging value. */
    private readonly logging: LoggingManager,
  ) {
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
        const overlayWindow = this.overlayWindow;
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send(
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
      backgroundColor: '#09090b',
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

    const overlayWindow = new BrowserWindow({
      parent: viewerWindow,
      width: 1280,
      height: 800,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.resolve(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    this.viewerWindow = viewerWindow;
    this.overlayWindow = overlayWindow;
    this.disposing = false;
    this.viewerClosePrepared = false;
    this.logging.attachRenderer(viewerWindow.webContents, 'viewer');
    this.logging.attachRenderer(overlayWindow.webContents, 'overlay');
    viewerWindow.setMenu(null);
    viewerWindow.setMenuBarVisibility(false);
    const overlayWebContentsId = overlayWindow.webContents.id;
    const viewerWebContentsId = viewerWindow.webContents.id;
    this.syncSiteViewBounds();
    this.syncVideoWindowBounds();
    this.syncOverlayBounds();

    viewerWindow.on('move', () => {
      this.syncSiteViewBounds();
      this.syncVideoWindowBounds();
      this.syncOverlayBounds();
    });
    /** Notifies the full screen changed. */
    const notifyFullScreenChanged = () => {
      const videoWindow = this.videoWindow;
      if (videoWindow && !videoWindow.isDestroyed()) {
        videoWindow.webContents.send(
          IPC_CHANNELS.application.fullScreenChanged,
          viewerWindow.isFullScreen(),
        );
      }
    };
    viewerWindow.on('enter-full-screen', notifyFullScreenChanged);
    viewerWindow.on('leave-full-screen', notifyFullScreenChanged);
    viewerWindow.on('resize', () => {
      this.syncSiteViewBounds();
      this.syncVideoWindowBounds();
      this.syncOverlayBounds();
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
      this.clearOverlayRevealTimer();
      this.pictureInPicture.handleViewerClosed();
      const siteWebContentsId = this.siteView?.webContents.id;
      if (siteWebContentsId) this.editingWebContentsIds.delete(siteWebContentsId);
      const videoWebContentsId = this.videoWindow?.webContents.id;
      if (videoWebContentsId) this.editingWebContentsIds.delete(videoWebContentsId);
      this.editingWebContentsIds.delete(overlayWebContentsId);
      this.editingWebContentsIds.delete(viewerWebContentsId);
      this.destroySiteView();
      if (this.videoWindow && !this.videoWindow.isDestroyed()) {
        this.videoWindow.destroy();
      }
      this.viewerWindow = undefined;
      this.videoWindow = undefined;
      this.overlayWindow = undefined;
      this.overlayVisible = false;
      this.viewerClosePrepared = false;
      this.viewerClosePreparation = undefined;
    });

    overlayWindow.webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(overlayWebContentsId);
      if (handleNativeEditingShortcut(overlayWindow.webContents, input, editing)) {
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
          overlayWindow.webContents.send(IPC_CHANNELS.overlay.requestClose);
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
        overlayWindow.webContents.send(IPC_CHANNELS.overlay.requestClose);
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
        overlayWindow.webContents.send(IPC_CHANNELS.overlay.requestClose);
        return;
      }
      if (
        !editing &&
        this.shortcutHandler?.(input, false)
      ) {
        event.preventDefault();
      }
    });

    overlayWindow.webContents.on('did-start-loading', () => {
      this.editingWebContentsIds.delete(overlayWebContentsId);
    });
    viewerWindow.webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(viewerWebContentsId);
      if (handleNativeEditingShortcut(viewerWindow.webContents, input, editing)) {
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
    await this.exitInternalVideoPictureInPicture(false);
    await this.pictureInPicture.exitAllModes();
    await this.cancelExternalLogin();
    this.closeSitePopups();
    this.newWindowPolicyResolver = undefined;
    this.siteActionHandler = undefined;
    this.navigationGuard = undefined;
    this.pictureInPictureGuard = undefined;
    this.pictureInPictureContentOverlaySelectors = undefined;
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
    const viewer = this.requireViewerWindow();
    const result = await dialog.showOpenDialog(viewer, {
      title: 'Open video',
      properties: ['openFile'],
      filters: [
        {
          name: 'Video files',
          extensions: Array.from(VIDEO_FILE_EXTENSIONS, (extension) =>
            extension.slice(1),
          ),
        },
        { name: 'All files', extensions: ['*']
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
    const video = this.videoWindow;
    if (
      !this.internalVideoVisible ||
      !video ||
      video.isDestroyed() ||
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
    const video = this.videoWindow;
    if (
      !this.internalVideoVisible ||
      this.internalVideoPictureInPicture ||
      !video ||
      video.isDestroyed() ||
      video.webContents.id !== webContentsId
    ) {
      return Promise.resolve(false);
    }

    const recovery = this.recreateVideoWindowWithSoftwareRenderer(video)
      .finally(() => {
        if (this.videoRendererRecovery === recovery) {
          this.videoRendererRecovery = undefined;
        }
      });
    this.videoRendererRecovery = recovery;
    return recovery;
  }

  /** Performs the recreate video window with software renderer operation. */
  private async recreateVideoWindowWithSoftwareRenderer(
    video: BrowserWindow,
  ): Promise<boolean> {
    console.warn(
      'The shared-texture Video renderer did not initialize; retrying with the libmpv WebGL renderer.',
    );
    this.videoSoftwareRenderer = true;
    this.internalVideoPresentation = { ready: false, width: 0, height: 0
    };
    video.hide();
    await this.mpv.detachWindow(video);
    if (this.videoWindow === video) this.videoWindow = undefined;
    video.destroy();

    if (!this.internalVideoVisible || this.disposing) return false;
    const replacement = await this.ensureVideoWindow();
    this.syncVideoWindowBounds();
    replacement.webContents.send(IPC_CHANNELS.video.visibilityChanged, true);
    replacement.show();
    replacement.moveTop();
    replacement.focus();
    replacement.webContents.focus();
    return true;
  }

  /** Performs the queue video open request operation. */
  queueVideoOpenRequest(request: VideoOpenRequest): void {
    this.pendingVideoOpenRequest = request;
    if (request.kind === 'local') this.lastLocalVideoOpenRequest = request;
  }

  /** Performs the dispatch site action operation. */
  private dispatchSiteAction(action: string): void {
    const handler = this.siteActionHandler;
    if (!handler) {
      console.warn(`No site action handler is registered for: ${action}`);
      return;
    }

    void handler(action).then((handled) => {
      if (!handled) {
        console.warn(`The current site did not handle action: ${action}`);
      }
    }).catch((error: unknown) => {
      console.error(`Site action failed: ${action}`, error);
    });
  }

  /** Loads the overlay. */
  async loadOverlay(): Promise<void> {
    const overlay = this.requireOverlayWindow();
    await overlay.loadFile(path.resolve(__dirname, '../renderer/index.html'));
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
      debug: (message, ...args) => console.debug(message, ...args),
      info: (message, ...args) => console.info(message, ...args),
      warn: (message, ...args) => console.warn(message, ...args),
      error: (message, ...args) => console.error(message, ...args),
    };
    const externalBrowser: SiteExternalBrowser = {
      login: (options) => {
        if (!permissions.has('external-browser')) {
          throw new Error('This Provider does not have the external-browser permission.');
        }
        return this.runExternalLogin(options, webContents, siteSession, viewer);
      },
      close: () => permissions.has('external-browser')
        ? this.cancelExternalLogin()
        : Promise.resolve(),
    };
    return {
      /** The viewer value. */
      viewer,
      // SiteManager keeps this core pipeline for application-owned policies
      // and removes it from the Provider view when permission is not granted.
      /** The page value. */
      page: createSitePagePipeline(webContents, logger),
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
        ? createSiteCookieStore(siteSession)
        : undefined,
      /** The logger value. */
      logger,
      /** The open external value. */
      openExternal: (url) => {
        if (!permissions.has('navigation')) {
          throw new Error('Opening an external URL requires navigation permission.');
        }
        return openInDefaultBrowser(url);
      },
    };
  }

  /** Sets the always on top. */
  setAlwaysOnTop(enabled: boolean): void {
    this.appAlwaysOnTop = enabled;
    if (!this.isAnyPictureInPictureActive()) {
      const viewer = this.viewerWindow;
      if (viewer && !viewer.isDestroyed()) {
        this.applyAlwaysOnTop(viewer, enabled);
      }
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
      // electron-mpv-video's closed listener reads webContents.id. Detach while
      // the BrowserWindow is still alive so that listener never observes a
      // destroyed Electron object during an ordinary title-bar close.
      const video = this.videoWindow;
      if (video && !video.isDestroyed()) {
        await this.mpv.detachWindow(video);
        video.destroy();
        this.videoWindow = undefined;
      }
    } catch (error) {
      console.error('Failed to detach MPV before closing the Video window.', error);
      await this.mpv.dispose().catch((disposeError: unknown) => {
        console.error('Failed to dispose MPV after detach failed.', disposeError);
      });
    } finally {
      this.viewerClosePrepared = true;
      this.viewerClosePreparation = undefined;
      if (!viewer.isDestroyed()) viewer.close();
    }
  }

  /** Applies the always on top. */
  private applyAlwaysOnTop(viewer: BrowserWindow, enabled: boolean): void {
    viewer.setAlwaysOnTop(enabled);
    const overlay = this.overlayWindow;
    if (overlay && !overlay.isDestroyed()) {
      // The menu is a separate native child window. Giving it the same level
      // as the viewer prevents macOS from placing the two windows in different
      // display/Space layers during an AOT drag.
      overlay.setAlwaysOnTop(enabled);
    }
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
      if (
        overlay &&
        !overlay.isDestroyed() &&
        overlay.isVisibleOnAllWorkspaces() !== enabled
      ) {
        overlay.setVisibleOnAllWorkspaces(enabled, {
          visibleOnFullScreen: false,
          skipTransformProcessType: true,
        });
      }
    }
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
    this.applyAlwaysOnTop(viewer, this.appAlwaysOnTop);
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
      label: display.label.trim() || `Display ${String(index + 1)}`,
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
      console.error('PiP could not restore the viewer window.', error);
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
  }

  /** Sets the internal video presentation. */
  setInternalVideoPresentation(webContentsId: number, value: unknown): boolean {
    const video = this.videoWindow;
    if (
      !this.internalVideoVisible ||
      !video ||
      video.isDestroyed() ||
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
    const video = this.requireVideoWindow();
    const minimumSize = video.getMinimumSize();
    const saved: InternalVideoPictureInPictureState = {
      minimumSize: [minimumSize[0] ?? 0, minimumSize[1] ?? 0],
      movable: video.isMovable(),
      resizable: video.isResizable(),
      visibleOnAllWorkspaces: video.isVisibleOnAllWorkspaces(),
    };
    this.internalVideoPictureInPicture = saved;
    this.suspendViewerAlwaysOnTopForPictureInPicture();

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
      viewer.getBounds(),
      preferred,
      this.pictureInPicturePlacement,
    );
    if (process.platform === 'darwin') {
      this.prepareMacApplicationForInternalVideoPictureInPicture();
    }
    video.hide();
    video.setParentWindow(null);
    viewer.hide();
    video.setMinimumSize(
      Math.min(PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.width, bounds.width),
      Math.min(PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.height, bounds.height),
    );
    video.setMovable(true);
    video.setResizable(true);
    video.setAspectRatio(aspectRatio ?? 0);
    video.setBounds(bounds, false);
    if (process.platform === 'darwin') {
      video.setAlwaysOnTop(true, 'screen-saver');
      video.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true
      });
    } else {
      video.setAlwaysOnTop(true, 'screen-saver');
    }
    video.webContents.send(
      IPC_CHANNELS.video.pictureInPictureChanged,
      true,
    );
    if (process.platform === 'darwin') {
      this.presentInternalVideoPictureInPicture(video);
      this.scheduleInternalVideoPictureInPictureReassertion();
    } else {
      video.show();
      video.moveTop();
      video.focus();
      video.webContents.focus();
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
    const viewer = this.viewerWindow;
    const video = this.videoWindow;
    if (video && !video.isDestroyed()) {
      const placement = captureInternalVideoPictureInPicturePlacement(video);
      if (placement) await this.pictureInPicturePlacementRecorder?.(placement);
    }
    this.internalVideoPictureInPicture = undefined;
    if (
      viewer &&
      !viewer.isDestroyed() &&
      video &&
      !video.isDestroyed()
    ) {
      video.webContents.send(
        IPC_CHANNELS.video.pictureInPictureChanged,
        false,
      );
      video.hide();
      video.setAspectRatio(0);
      video.setAlwaysOnTop(false);
      if (process.platform === 'darwin') {
        disableMacOSFullScreenAuxiliary(video);
        video.setVisibleOnAllWorkspaces(state.visibleOnAllWorkspaces, {
          visibleOnFullScreen: state.visibleOnAllWorkspaces,
        });
        // PiP temporarily adopts Chatty's Dock-hidden UI-element presentation
        // so it can join another application's fullscreen Space. Reverse that
        // process state before showing Kawaikara's normal viewer again.
        app.setActivationPolicy('regular');
        await app.dock?.show();
      }
      video.setMinimumSize(...state.minimumSize);
      video.setMovable(state.movable);
      video.setResizable(state.resizable);
      video.setParentWindow(viewer);
      if (!this.disposing) {
        viewer.show();
        this.syncVideoWindowBounds();
        if (this.internalVideoVisible) {
          video.show();
          video.moveTop();
        }
      }
    }
    this.restoreViewerAlwaysOnTopAfterPictureInPicture();
    if (notify) {
      this.notifyPictureInPictureChanged({ status: 'exited', mode: 'window'
      });
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
        const video = this.videoWindow;
        if (
          !this.internalVideoPictureInPicture ||
          !video ||
          video.isDestroyed()
        ) {
          return;
        }
        this.presentInternalVideoPictureInPicture(video);
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

  /** Notifies the picture in picture changed. */
  private notifyPictureInPictureChanged(result: {
    /** The status value. */
    readonly status: 'entered' | 'exited';
    /** The mode value. */
    readonly mode: 'window';
  }
  ): void {
    const overlay = this.overlayWindow;
    if (overlay && !overlay.isDestroyed()) {
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
    const overlay = this.overlayWindow;
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send(IPC_CHANNELS.development.stateChanged, state);
    }
  }

  /** Performs the go back operation. */
  goBack(): boolean {
    const navigation = this.requireActiveViewerWebContents().navigationHistory;
    if (!navigation.canGoBack()) return false;
    navigation.goBack();
    return true;
  }

  /** Performs the go forward operation. */
  goForward(): boolean {
    const navigation = this.requireActiveViewerWebContents().navigationHistory;
    if (!navigation.canGoForward()) return false;
    navigation.goForward();
    return true;
  }

  /** Sets the editing state. */
  setEditingState(webContentsId: number, editing: boolean): boolean {
    const viewerId = this.siteView?.webContents.id;
    const internalViewerId = this.videoWindow?.webContents.id;
    const overlayId = this.overlayWindow?.webContents.id;
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
    const overlay = this.requireOverlayWindow();
    this.overlayView = 'menu';
    this.syncOverlayBounds();
    this.overlayVisible = true;
    overlay.webContents.send(IPC_CHANNELS.overlay.showMenu);
    this.revealOverlay(overlay);
  }

  /** Performs the show preferences overlay operation. */
  showPreferencesOverlay(): void {
    const overlay = this.requireOverlayWindow();
    this.overlayView = 'preference';
    this.syncOverlayBounds();
    this.overlayVisible = true;
    overlay.webContents.send(IPC_CHANNELS.overlay.showPreferences);
    this.revealOverlay(overlay);
  }

  /** Performs the show update overlay operation. */
  showUpdateOverlay(state: ApplicationUpdatePanelState): void {
    const overlay = this.requireOverlayWindow();
    this.overlayView = 'update';
    this.syncOverlayBounds();
    this.overlayVisible = true;
    overlay.webContents.send(IPC_CHANNELS.overlay.showUpdate, state);
    this.revealOverlay(overlay);
  }

  /** Updates the update overlay. */
  updateUpdateOverlay(state: ApplicationUpdatePanelState): void {
    const overlay = this.overlayWindow;
    if (!overlay || overlay.isDestroyed()) return;
    overlay.webContents.send(
      IPC_CHANNELS.application.updateStateChanged,
      state,
    );
  }

  /** Performs the hide overlay operation. */
  hideOverlay(): void {
    this.overlayVisible = false;
    const overlay = this.overlayWindow;
    if (overlay && !overlay.isDestroyed()) {
      this.clearOverlayRevealTimer();
      overlay.setOpacity(1);
      overlay.webContents.send(IPC_CHANNELS.overlay.hidden);
      overlay.hide();
    }
    this.viewerWindow?.focus();
    if (this.internalVideoVisible) {
      const video = this.videoWindow;
      if (video && !video.isDestroyed()) {
        video.show();
        video.focus();
        video.webContents.focus();
      }
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
      const overlay = this.requireOverlayWindow();
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
    this.syncVideoWindowBounds();
    if (process.platform === 'darwin') app.focus({ steal: true
    });
    viewer.moveTop();
    viewer.focus();
    if (this.internalVideoVisible) {
      const video = this.videoWindow;
      if (video && !video.isDestroyed()) {
        video.show();
        video.moveTop();
        video.focus();
        video.webContents.focus();
      }
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
      const video = this.videoWindow;
      if (video && !video.isDestroyed()) {
        video.webContents.send(IPC_CHANNELS.video.visibilityChanged, false);
        video.hide();
      }
    }
    if (this.siteView && !this.siteView.webContents.isDestroyed()) {
      await this.pictureInPicture.exitAllModes();
      await prepareCurrentDocumentForNavigation(this.siteView.webContents);
    }
    await this.cancelExternalLogin();
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

    this.siteView = siteView;
    this.configureSiteSession(siteSession);
    // Provider injections log with a stable prefix. Forward only those
    // messages instead of every third-party site console line, which keeps
    // the application log useful when diagnosing quality/ad playback.
    this.logging.attachRenderer(
      siteView.webContents,
      `site:${runtime.siteId}`,
      (message) => message.includes('[Kawaikara/'),
    );
    this.attachSiteWebContents(siteView.webContents, siteSession);
    viewerWindow.contentView.addChildView(siteView);
    this.siteViewAttached = true;
    this.syncSiteViewBounds();
    siteView.webContents.focus();
    console.info(
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
          webContents.isDestroyed()
        ) {
          return;
        }
        // WebContentsView can occasionally retain a missing compositor
        // surface after a same-document player transition. Reasserting its
        // visibility and invalidating the surface is safe and does not reload
        // or reset the stream.
        siteView.setVisible(true);
        webContents.invalidate();
        console.debug(`Refreshed the site compositor surface (${reason}).`);
      }, 0);
    };
    webContents.on('dom-ready', () => {
      this.installRemoteThemeBridge(webContents);
      void webContents
        .insertCSS(REMOTE_SCROLLBAR_CSS, { cssOrigin: 'user'
        })
        .catch((error: unknown) => {
          console.debug('The site scrollbar theme could not be applied.', error);
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
        console.warn('Site main-frame load failed.', {
          errorCode,
          errorDescription,
          url: validatedURL,
        });
      },
    );
    webContents.on('render-process-gone', (_event, details) => {
      console.error('Site renderer process exited.', details);
      if (details.reason === 'clean-exit' || webContents.isDestroyed()) return;
      setTimeout(() => {
        if (!webContents.isDestroyed()) webContents.reload();
      }, 500);
    });
    webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(webContentsId);
      if (handleNativeEditingShortcut(webContents, input, editing)) {
        event.preventDefault();
        return;
      }
      if (this.shortcutHandler?.(input, editing)) event.preventDefault();
    });
    /** Performs the guard navigation operation. */
    const guardNavigation = (event: Electron.Event, url: string): void => {
      const action = this.parseSiteAction(url);
      if (action !== undefined) {
        event.preventDefault();
        this.dispatchSiteAction(action);
        return;
      }
      if (this.navigationGuard && !this.navigationGuard(url)) {
        event.preventDefault();
        console.debug(`Blocked guarded site navigation: ${url}`);
      }
    };
    webContents.on('will-navigate', guardNavigation);
    webContents.on('will-redirect', guardNavigation);
    webContents.on('will-frame-navigate', (details) => {
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
      this.viewerWindow?.setTitle(this.appTitle);
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
      const action = this.parseSiteAction(url);
      if (action !== undefined) {
        this.dispatchSiteAction(action);
        return { action: 'deny'
        };
      }
      if (this.navigationGuard && !this.navigationGuard(url)) {
        console.debug(`Blocked guarded site window open: ${url}`);
        return { action: 'deny'
        };
      }

      const policy = this.newWindowPolicyResolver?.(url) ?? 'viewer';
      switch (policy) {
        case 'external':
          void openInDefaultBrowser(url).catch((error: unknown) => {
            console.error(`Failed to open ${url} in the default browser.`, error);
          });
          return { action: 'deny'
          };
        case 'viewer':
          void webContents.loadURL(url).catch((error: unknown) => {
            console.error(`Failed to open ${url} in the site viewer.`, error);
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
        console.debug('The live site theme bridge could not be installed.', error);
      });
  }

  /** Performs the configure site session operation. */
  private configureSiteSession(siteSession: Session): void {
    if (this.configuredSiteSessions.has(siteSession)) return;
    this.configuredSiteSessions.add(siteSession);
    siteSession.webRequest.onBeforeRequest((details, callback) => {
      const transformed = this.requestTransformer?.({
        url: details.url,
        method: details.method,
        requestHeaders: {},
      });
      callback(transformed ?? {});
    });
    siteSession.webRequest.onBeforeSendHeaders((details, callback) => {
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

  /** Performs the destroy site view operation. */
  private destroySiteView(): void {
    const siteView = this.siteView;
    this.siteView = undefined;
    if (!siteView) return;
    const webContentsId = siteView.webContents.id;
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
    if (!siteView.webContents.isDestroyed()) siteView.webContents.close();
  }

  /** Creates the site viewer. */
  private createSiteViewer(
    webContents: WebContents,
    permissions: ReadonlySet<string>,
  ): SiteViewer {
    /** Returns the web contents. */
    const getWebContents = () => {
      if (webContents.isDestroyed()) {
        throw new Error('The site WebContents is no longer active.');
      }
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
        this.currentVideoOpenRequest = null;
        await loadURLWithNavigationRecovery(contents, url);
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
        const viewer = this.requireViewerWindow();
        const siteView = this.requireSiteView();
        if (this.siteViewAttached) {
          viewer.contentView.removeChildView(siteView);
          this.siteViewAttached = false;
        }
        this.internalVideoVisible = true;
        this.internalVideoPresentation = { ready: false, width: 0, height: 0
        };
        // The Video renderer stays alive while a remote Provider is active.
        // Re-send the last local source when it becomes visible again so
        // libmpv recreates its Windows shared texture instead of retaining a
        // stale surface. macOS happens to preserve that surface, which hid the
        // lifecycle bug there.
        const request =
          this.pendingVideoOpenRequest ?? this.lastLocalVideoOpenRequest;
        this.pendingVideoOpenRequest = undefined;
        this.currentVideoOpenRequest = request ?? null;
        const video = await this.ensureVideoWindow();
        this.syncVideoWindowBounds();
        video.webContents.send(IPC_CHANNELS.video.visibilityChanged, true);
        if (request) {
          video.webContents.send(
            IPC_CHANNELS.video.openRequestChanged,
            request,
          );
        }
        video.show();
        video.moveTop();
        video.focus();
        video.webContents.focus();
      },
    };
  }

  /** Performs the use site browser identity operation. */
  private useSiteBrowserIdentity(
    webContents: WebContents,
    options: SiteBrowserIdentityOptions,
  ): Disposable {
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
    await this.exitInternalVideoPictureInPicture();
    await this.pictureInPicture.exitAllModes();
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

    try {
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
          console.error(`Failed to restore ${returnUrl} after external login.`, error);
        });
      }
    }
  }

  /** Determines whether the cel external login condition applies. */
  private async cancelExternalLogin(): Promise<void> {
    ++this.externalLoginGeneration;
    await this.externalBrowser.close();
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

  /** Performs the sync video window bounds operation. */
  private syncVideoWindowBounds(): void {
    const viewer = this.viewerWindow;
    const video = this.videoWindow;
    if (
      !this.internalVideoVisible ||
      this.internalVideoPictureInPicture ||
      !viewer ||
      viewer.isDestroyed() ||
      !video ||
      video.isDestroyed()
    ) {
      return;
    }
    video.setBounds(viewer.getContentBounds(), false);
  }

  /** Ensures the video window. */
  private ensureVideoWindow(): Promise<BrowserWindow> {
    const existing = this.videoWindow;
    if (existing && !existing.isDestroyed()) return Promise.resolve(existing);
    if (this.videoWindowLoading) return this.videoWindowLoading;

    const viewer = this.requireViewerWindow();
    const bounds = viewer.getContentBounds();
    const video = new BrowserWindow({
      parent: viewer,
      ...bounds,
      show: false,
      frame: false,
      title: 'Kawaikara Video',
      backgroundColor: '#050506',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.resolve(__dirname, '../preload/viewer.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        ...(this.videoSoftwareRenderer
          ? { disableBlinkFeatures: 'WebGPU'
          }
          : {}),
        // electron-mpv-video exposes its renderer bridge from this preload.
        sandbox: false,
      },
    });
    this.videoWindow = video;
    this.logging.attachRenderer(video.webContents, 'video');
    this.mpv.attachWindow(video);
    video.setMenu(null);
    video.setMenuBarVisibility(false);
    const webContentsId = video.webContents.id;
    video.webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(webContentsId);
      if (handleNativeEditingShortcut(video.webContents, input, editing)) {
        event.preventDefault();
        return;
      }
      const plainTab =
        input.type === 'keyDown' &&
        !input.isAutoRepeat &&
        !input.isComposing &&
        !input.control &&
        !input.meta &&
        !input.alt &&
        !input.shift &&
        input.key.toLowerCase() === 'tab';
      if (plainTab) {
        event.preventDefault();
        // Video owns several text and range inputs whose focus can outlive the
        // panel that contained them. Keep the app-level Menu toggle reliable
        // without allowing Tab to move focus through the Video controls.
        if (!this.internalVideoPictureInPicture) this.toggleOverlay();
        return;
      }
      if (this.shortcutHandler?.(input, editing)) event.preventDefault();
    });
    video.webContents.on('did-start-loading', () => {
      this.editingWebContentsIds.delete(webContentsId);
    });
    video.webContents.on('page-title-updated', (event) => event.preventDefault());
    video.on('blur', () => {
      this.scheduleInternalVideoPictureInPictureReassertion();
    });
    video.on('show', () => {
      this.scheduleInternalVideoPictureInPictureReassertion();
    });
    video.on('close', (event) => {
      if (this.disposing) return;
      event.preventDefault();
      if (this.internalVideoPictureInPicture) {
        void this.restorePictureInPicture();
      } else {
        this.viewerWindow?.close();
      }
    });
    video.on('closed', () => {
      this.clearInternalVideoPictureInPictureReassertions();
      this.editingWebContentsIds.delete(webContentsId);
      if (this.videoWindow === video) {
        this.videoWindow = undefined;
        this.internalVideoVisible = false;
        this.internalVideoPresentation = { ready: false, width: 0, height: 0
        };
      }
    });

    const loading = video
      .loadFile(path.resolve(__dirname, '../renderer/video.html'))
      .then(() => video)
      .catch(async (error: unknown) => {
        if (!video.isDestroyed()) {
          await this.mpv.detachWindow(video).catch(() => undefined);
          video.destroy();
        }
        if (this.videoWindow === video) this.videoWindow = undefined;
        throw error;
      })
      .finally(() => {
        if (this.videoWindowLoading === loading) {
          this.videoWindowLoading = undefined;
        }
      });
    this.videoWindowLoading = loading;
    return loading;
  }

  /** Performs the sync overlay bounds operation. */
  private syncOverlayBounds(): void {
    if (!this.viewerWindow || !this.overlayWindow) {
      return;
    }

    if (this.overlayWindow.getParentWindow() !== this.viewerWindow) {
      // macOS can temporarily separate child-window ordering while an AOT
      // window crosses displays. Reassert the native parent relationship at
      // every geometry synchronization so the menu follows as one surface.
      this.overlayWindow.setParentWindow(this.viewerWindow);
    }
    const contentBounds = this.viewerWindow.getContentBounds();
    const bounds: Rectangle = {
      x: contentBounds.x,
      y: contentBounds.y,
      width: contentBounds.width,
      height: contentBounds.height,
    };
    this.overlayWindow.setBounds(bounds, false);
  }

  /** Performs the reveal overlay operation. */
  private revealOverlay(overlay: BrowserWindow): void {
    this.clearOverlayRevealTimer();
    if (overlay.isVisible()) {
      overlay.setOpacity(1);
      overlay.moveTop();
      overlay.focus();
      return;
    }

    // The renderer stays alive while hidden. Give React/Motion two frames to
    // commit the off-screen entry pose before exposing the child window, so a
    // completed menu frame cannot flash during a site navigation.
    overlay.setOpacity(0);
    overlay.showInactive();
    overlay.moveTop();
    this.overlayRevealTimer = setTimeout(() => {
      this.overlayRevealTimer = undefined;
      if (!this.overlayVisible || overlay.isDestroyed()) return;
      overlay.setOpacity(1);
      overlay.focus();
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
    if (this.internalVideoVisible) return this.videoWindow?.webContents;
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

  /** Performs the require video window operation. */
  private requireVideoWindow(): BrowserWindow {
    const video = this.videoWindow;
    if (!video || video.isDestroyed()) {
      throw new Error('The Video window has not been created.');
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

  /** Performs the require overlay window operation. */
  private requireOverlayWindow(): BrowserWindow {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      throw new Error('The renderer overlay window has not been created.');
    }
    return this.overlayWindow;
  }
}
