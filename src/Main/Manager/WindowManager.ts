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
  SiteExternalBrowser,
  SiteViewer,
} from '@kawaikara/site-api';
import { ExternalBrowserManager } from './ExternalBrowserManager';
import { UnifiedPictureInPictureManager } from './UnifiedPictureInPictureManager';
import type { SiteRuntimeProfile } from './SiteManager';
import {
  IPC_CHANNELS,
  type ApplicationUpdatePanelState,
  type AppLocale,
  type AppTheme,
  type DisplayInfo,
  type DevToolsMode,
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
import {
  getExternalLoginViewData,
  resolveAppLocale,
} from '../Functional/Locale';
import { openInDefaultBrowser } from '../Functional/DefaultBrowser';
import { PAUSE_DOCUMENT_MEDIA_SCRIPT } from '../Inject/MediaCleanup';
import { attachRendererLogging } from '../Logging';
import {
  disableMacOSFullScreenAuxiliary,
  enableMacOSFullScreenAuxiliary,
} from '../MacOSWindowSpaces';

const NAVIGATION_HANDOFF_SETTLE_MS = 180;
const INTERNAL_VIDEO_PIP_MARGIN = 20;
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

export type PictureInPictureManagerFactory = (
  ...args: ConstructorParameters<typeof UnifiedPictureInPictureManager>
) => UnifiedPictureInPictureManager;

interface InternalVideoPictureInPictureState {
  readonly minimumSize: readonly [number, number];
  readonly movable: boolean;
  readonly resizable: boolean;
  readonly visibleOnAllWorkspaces: boolean;
}

export class WindowManager {
  private readonly externalBrowser: ExternalBrowserManager;
  private readonly mpv: MpvMain = createMpvMain({
    addonPath: resolveMpvAddonPath(),
  });
  // The previous native/Game PiP implementation remains in
  // PictureInPictureManager.ts as a legacy fallback while the unified,
  // dedicated-window PiP is evaluated.
  private readonly pictureInPicture: UnifiedPictureInPictureManager;
  private readonly editingWebContentsIds = new Set<number>();
  private readonly sitePopupWindows = new Set<BrowserWindow>();
  private readonly remoteThemeTasks = new Map<number, Promise<void>>();
  private readonly remoteThemeCssKeys = new Map<number, string>();
  private appTitle = 'Kawaikara';
  private appLocale: AppLocale = 'system';
  private appTheme: AppTheme = 'dark';
  private systemLocale = 'en-US';
  private viewerWindow?: BrowserWindow;
  private videoWindow?: BrowserWindow;
  private videoWindowLoading?: Promise<BrowserWindow>;
  private videoSoftwareRenderer = false;
  private videoRendererRecovery?: Promise<boolean>;
  private overlayWindow?: BrowserWindow;
  private siteView?: WebContentsView;
  private siteViewAttached = false;
  private internalVideoVisible = false;
  private internalVideoPresentation: VideoPresentationState = {
    ready: false,
    width: 0,
    height: 0,
  };
  private internalVideoPictureInPicture?: InternalVideoPictureInPictureState;
  private appAlwaysOnTop = false;
  private pictureInPicturePlacement = DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;
  private pictureInPicturePortraitSize =
    DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE;
  private pictureInPictureSize = DEFAULT_PICTURE_IN_PICTURE_SIZE;
  private readonly configuredSiteSessions = new WeakSet<Session>();
  private overlayVisible = false;
  private overlayView: OverlayView = 'menu';
  private closeMenuOnEscape = true;
  private closeMenuOnOutsideClick = true;
  private currentVideoOpenRequest: VideoOpenRequest | null = null;
  private pendingVideoOpenRequest?: VideoOpenRequest;
  private lastLocalVideoOpenRequest?: Extract<
    VideoOpenRequest,
    { readonly kind: 'local' }
  >;
  private externalLoginGeneration = 0;
  private newWindowPolicyResolver?: (url: string) => NewWindowPolicy;
  private siteActionHandler?: (action: string) => Promise<boolean>;
  private navigationGuard?: (url: string) => boolean;
  private pictureInPictureGuard?: (url: string) => boolean;
  private pictureInPictureStateHandler?: (active: boolean) => void;
  private shortcutHandler?: (input: Input, editing: boolean) => boolean;
  private requestHeadersTransformer?: (
    details: SiteRequestDetails,
  ) => SiteRequestHeaders | undefined;
  private requestTransformer?: (
    details: SiteRequestDetails,
  ) => SiteRequestRedirect | undefined;
  private pictureInPicturePlacementRecorder?: (
    placement: PictureInPictureLastPlacement,
  ) => Promise<void> | void;
  private restoringPictureInPicture = false;
  private disposing = false;
  private viewerClosePrepared = false;
  private viewerClosePreparation?: Promise<void>;
  private readonly internalVideoPictureInPictureReassertTimers = new Set<
    ReturnType<typeof setTimeout>
  >();
  private overlayRevealTimer?: ReturnType<typeof setTimeout>;

  constructor(
    externalBrowser: ExternalBrowserManager,
    createPictureInPicture: PictureInPictureManagerFactory,
  ) {
    this.externalBrowser = externalBrowser;
    this.pictureInPicture = createPictureInPicture(
      () => this.requireViewerWindow(),
      () => this.requireSiteView(),
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
        if (viewer && !viewer.isDestroyed()) this.focusViewer();
      },
      (placement) => this.pictureInPicturePlacementRecorder?.(placement),
    );
  }

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
    attachRendererLogging(viewerWindow.webContents, 'viewer');
    attachRendererLogging(overlayWindow.webContents, 'overlay');
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
      if (
        this.pictureInPicture.isActive() ||
        this.internalVideoPictureInPicture
      ) {
        event.preventDefault();
        void this.restorePictureInPicture();
        return;
      }
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

  setSiteHandlers(handlers: {
    resolveNewWindowPolicy(url: string): NewWindowPolicy;
    handleAction(action: string): Promise<boolean>;
    allowNavigation(url: string): boolean;
    allowPictureInPicture(url: string): boolean;
    transformRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined;
    transformRequestHeaders(
      details: SiteRequestDetails,
    ): SiteRequestHeaders | undefined;
  }): void {
    this.newWindowPolicyResolver = handlers.resolveNewWindowPolicy;
    this.siteActionHandler = handlers.handleAction;
    this.navigationGuard = handlers.allowNavigation;
    this.pictureInPictureGuard = handlers.allowPictureInPicture;
    this.requestTransformer = handlers.transformRequest;
    this.requestHeadersTransformer = handlers.transformRequestHeaders;
  }

  setShortcutHandler(handler: (input: Input, editing: boolean) => boolean): void {
    this.shortcutHandler = handler;
  }

  setPictureInPictureStateHandler(handler: (active: boolean) => void): void {
    this.pictureInPictureStateHandler = handler;
    handler(
      this.pictureInPicture.isActive() ||
        this.internalVideoPictureInPicture !== undefined,
    );
  }

  isPictureInPictureActive(): boolean {
    return this.isAnyPictureInPictureActive();
  }

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
    this.pictureInPictureStateHandler = undefined;
    this.requestTransformer = undefined;
    this.requestHeadersTransformer = undefined;
    this.shortcutHandler = undefined;
    this.destroySiteView();
    await this.mpv.dispose();
  }

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
      const request: Extract<VideoOpenRequest, { readonly kind: 'local' }> = {
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
        { name: 'All files', extensions: ['*'] },
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

  getVideoPlaybackCapabilities(): VideoPlaybackCapabilities {
    const nativePlatform =
      (process.platform === 'win32' && process.arch === 'x64') ||
      (process.platform === 'darwin' && process.arch === 'arm64');
    return {
      platform: process.platform,
      arch: process.arch,
      nativeBackendAvailable: nativePlatform && existsSync(resolveMpvAddonPath()),
      electronGpuAccelerationEnabled: app.isHardwareAccelerationEnabled(),
      hardwareAccelerationDisabled: process.env.MPV_HWDEC === 'no',
    };
  }

  queueYouTubeDownloader(url: string): void {
    this.pendingVideoOpenRequest = { kind: 'youtube', url };
  }

  getCurrentVideoOpenRequest(): VideoOpenRequest | null {
    return this.currentVideoOpenRequest;
  }

  activateVideoOpenRequest(
    webContentsId: number,
    request: Extract<VideoOpenRequest, { readonly kind: 'local' }>,
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

  private async recreateVideoWindowWithSoftwareRenderer(
    video: BrowserWindow,
  ): Promise<boolean> {
    console.warn(
      'The shared-texture Video renderer did not initialize; retrying with the libmpv WebGL renderer.',
    );
    this.videoSoftwareRenderer = true;
    this.internalVideoPresentation = { ready: false, width: 0, height: 0 };
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

  queueVideoOpenRequest(request: VideoOpenRequest): void {
    this.pendingVideoOpenRequest = request;
    if (request.kind === 'local') this.lastLocalVideoOpenRequest = request;
  }

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

  async loadOverlay(): Promise<void> {
    const overlay = this.requireOverlayWindow();
    await overlay.loadFile(path.resolve(__dirname, '../renderer/index.html'));
  }

  async createSiteContext(runtime: SiteRuntimeProfile): Promise<SiteContext> {
    const { siteSession, webContents } = await this.activateSiteView(runtime);
    const viewer = this.createSiteViewer(webContents);
    const externalBrowser: SiteExternalBrowser = {
      login: (options) =>
        this.runExternalLogin(options, webContents, siteSession, viewer),
      close: () => this.cancelExternalLogin(),
    };
    return {
      viewer,
      actions: {
        createUrl: (action) => {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(action)) {
            throw new Error(`Invalid site action: ${action}`);
          }
          return `kawaikara-action://invoke/${encodeURIComponent(action)}`;
        },
      },
      externalBrowser,
      logger: {
        debug: (message, ...args) => console.debug(message, ...args),
        info: (message, ...args) => console.info(message, ...args),
        warn: (message, ...args) => console.warn(message, ...args),
        error: (message, ...args) => console.error(message, ...args),
      },
      openExternal: (url) => openInDefaultBrowser(url),
    };
  }

  setAlwaysOnTop(enabled: boolean): void {
    this.appAlwaysOnTop = enabled;
    if (!this.isAnyPictureInPictureActive()) {
      const viewer = this.viewerWindow;
      if (viewer && !viewer.isDestroyed()) {
        this.applyAlwaysOnTop(viewer, enabled);
      }
    }
  }

  private async prepareViewerWindowClose(viewer: BrowserWindow): Promise<void> {
    try {
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

  private applyAlwaysOnTop(viewer: BrowserWindow, enabled: boolean): void {
    viewer.setAlwaysOnTop(enabled);
    if (process.platform === 'darwin') {
      // Normal AOT intentionally stays out of another application's native
      // fullscreen Space. Dedicated PiP windows retain fullscreen visibility.
      viewer.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: false });
    }
  }

  private isAnyPictureInPictureActive(): boolean {
    return Boolean(
      this.internalVideoPictureInPicture || this.pictureInPicture.isActive(),
    );
  }

  private suspendViewerAlwaysOnTopForPictureInPicture(): void {
    const viewer = this.viewerWindow;
    if (viewer && !viewer.isDestroyed()) this.applyAlwaysOnTop(viewer, false);
  }

  private restoreViewerAlwaysOnTopAfterPictureInPicture(): void {
    if (this.disposing || this.isAnyPictureInPictureActive()) return;
    const viewer = this.viewerWindow;
    if (!viewer || viewer.isDestroyed()) return;
    this.applyAlwaysOnTop(viewer, this.appAlwaysOnTop);
  }

  setMenuDismissBehavior(
    closeOnEscape: boolean,
    closeOnOutsideClick: boolean,
  ): void {
    this.closeMenuOnEscape = closeOnEscape;
    this.closeMenuOnOutsideClick = closeOnOutsideClick;
  }

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

  openDevTools(mode: DevToolsMode): void {
    const webContents = this.getActiveViewerWebContents();
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('There is no active site view to inspect.');
    }
    webContents.openDevTools({ mode, activate: true });
  }

  setPictureInPictureSize(preference: PictureInPictureSizePreference): void {
    this.pictureInPictureSize = preference;
    this.pictureInPicture.setWindowSize(preference);
  }

  setPictureInPicturePortraitSize(
    preference: PictureInPictureSizePreference,
  ): void {
    this.pictureInPicturePortraitSize = preference;
    this.pictureInPicture.setPortraitWindowSize(preference);
  }

  setPictureInPicturePlacement(
    preference: PictureInPicturePlacementPreference,
  ): void {
    this.pictureInPicturePlacement = preference;
    this.pictureInPicture.setWindowPlacement(preference);
  }

  setPictureInPicturePlacementRecorder(
    recorder: (
      placement: PictureInPictureLastPlacement,
    ) => Promise<void> | void,
  ): void {
    this.pictureInPicturePlacementRecorder = recorder;
  }

  async togglePictureInPicture() {
    if (this.internalVideoVisible) {
      return this.toggleInternalVideoPictureInPicture();
    }
    if (!this.canEnterPictureInPicture()) {
      return { status: 'no-video' as const, mode: 'video' as const };
    }
    return this.togglePictureInPictureWithOverlay(() =>
      this.pictureInPicture.toggle(),
    );
  }

  async toggleGamePictureInPicture() {
    if (this.internalVideoVisible) {
      return this.toggleInternalVideoPictureInPicture();
    }
    if (!this.canEnterPictureInPicture()) {
      return { status: 'no-video' as const, mode: 'window' as const };
    }
    return this.togglePictureInPictureWithOverlay(() =>
      this.pictureInPicture.toggle(),
    );
  }

  private canEnterPictureInPicture(): boolean {
    if (this.internalVideoPictureInPicture) return true;
    if (this.pictureInPicture.isActive()) return true;
    const webContents = this.requireSiteWebContents();
    return this.pictureInPictureGuard?.(webContents.getURL()) ?? true;
  }

  private async togglePictureInPictureWithOverlay(
    toggle: () => ReturnType<UnifiedPictureInPictureManager['toggle']>,
  ) {
    const entering = !this.pictureInPicture.isActive();
    if (entering) this.suspendViewerAlwaysOnTopForPictureInPicture();
    let result;
    try {
      result = await toggle();
    } catch (error) {
      this.restoreViewerAlwaysOnTopAfterPictureInPicture();
      throw error;
    }
    if (result.status !== 'entered') {
      this.restoreViewerAlwaysOnTopAfterPictureInPicture();
    }
    if (result.status === 'exited') {
      this.focusViewer();
    }
    return result;
  }

  private async restorePictureInPicture(): Promise<void> {
    if (this.restoringPictureInPicture) return;
    this.restoringPictureInPicture = true;
    try {
      await this.exitInternalVideoPictureInPicture();
      await this.pictureInPicture.exitAllModes();
      const viewer = this.viewerWindow;
      if (viewer && !viewer.isDestroyed()) this.focusViewer();
    } catch (error) {
      console.error('PiP could not restore the viewer window.', error);
    } finally {
      this.restoringPictureInPicture = false;
    }
  }

  setAppLocale(locale: AppLocale, systemLocale: string): void {
    this.appLocale = locale;
    this.systemLocale = systemLocale;
    const resolvedLocale = resolveAppLocale(locale, systemLocale);
    this.appTitle = resolveLocalizedAppTitle(resolvedLocale);
    this.viewerWindow?.setTitle(this.appTitle);
  }

  toggleAppFullScreen(): void {
    const viewer = this.requireViewerWindow();
    viewer.setFullScreen(!viewer.isFullScreen());
  }

  reloadViewer(): void {
    this.requireActiveViewerWebContents().reload();
  }

  setAppTheme(theme: AppTheme): void {
    this.appTheme = theme;
    nativeTheme.themeSource = theme;
    const siteWebContents = this.siteView?.webContents;
    if (siteWebContents && !siteWebContents.isDestroyed()) {
      this.applyThemeToRemoteWebContents(siteWebContents);
    }
    for (const popup of this.sitePopupWindows) {
      if (!popup.isDestroyed()) {
        this.applyThemeToRemoteWebContents(popup.webContents);
      }
    }
  }

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

  private async toggleInternalVideoPictureInPicture() {
    if (this.internalVideoPictureInPicture) {
      await this.exitInternalVideoPictureInPicture();
      this.focusViewer();
      return { status: 'exited' as const, mode: 'window' as const };
    }
    if (!this.internalVideoPresentation.ready) {
      return { status: 'no-video' as const, mode: 'window' as const };
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
    this.hideOverlay();

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
      video.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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
    this.notifyPictureInPictureChanged({ status: 'entered', mode: 'window' });
    return { status: 'entered' as const, mode: 'window' as const };
  }

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
      viewer.show();
      this.syncVideoWindowBounds();
      if (this.internalVideoVisible) {
        video.show();
        video.moveTop();
      }
    }
    this.restoreViewerAlwaysOnTopAfterPictureInPicture();
    if (notify) {
      this.notifyPictureInPictureChanged({ status: 'exited', mode: 'window' });
    }
  }

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

  private prepareMacApplicationForInternalVideoPictureInPicture(): void {
    // AppKit's FullScreenAuxiliary behavior requires an accessory process.
    // The native bridge then adds the existing true fullscreen Space that
    // Electron can omit when Kawaikara originally launched as a Dock app.
    app.setActivationPolicy('accessory');
    app.dock?.hide();
  }

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

  private clearInternalVideoPictureInPictureReassertions(): void {
    for (const timer of this.internalVideoPictureInPictureReassertTimers) {
      clearTimeout(timer);
    }
    this.internalVideoPictureInPictureReassertTimers.clear();
  }

  private notifyPictureInPictureChanged(result: {
    readonly status: 'entered' | 'exited';
    readonly mode: 'window';
  }): void {
    const overlay = this.overlayWindow;
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send(
        IPC_CHANNELS.media.pictureInPictureChanged,
        result,
      );
    }
    this.pictureInPictureStateHandler?.(result.status === 'entered');
  }

  isAppFullScreen(): boolean {
    return !this.internalVideoPictureInPicture &&
      this.requireViewerWindow().isFullScreen();
  }

  exitAppFullScreen(): void {
    const viewer = this.requireViewerWindow();
    if (viewer.isFullScreen()) viewer.setFullScreen(false);
  }

  goBack(): void {
    const navigation = this.requireActiveViewerWebContents().navigationHistory;
    if (navigation.canGoBack()) navigation.goBack();
  }

  goForward(): void {
    const navigation = this.requireActiveViewerWebContents().navigationHistory;
    if (navigation.canGoForward()) navigation.goForward();
  }

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

  showOverlay(): void {
    const overlay = this.requireOverlayWindow();
    this.overlayView = 'menu';
    this.syncOverlayBounds();
    this.overlayVisible = true;
    overlay.webContents.send(IPC_CHANNELS.overlay.showMenu);
    this.revealOverlay(overlay);
  }

  showPreferencesOverlay(): void {
    const overlay = this.requireOverlayWindow();
    this.overlayView = 'preference';
    this.syncOverlayBounds();
    this.overlayVisible = true;
    overlay.webContents.send(IPC_CHANNELS.overlay.showPreferences);
    this.revealOverlay(overlay);
  }

  showUpdateOverlay(state: ApplicationUpdatePanelState): void {
    const overlay = this.requireOverlayWindow();
    this.overlayView = 'update';
    this.syncOverlayBounds();
    this.overlayVisible = true;
    overlay.webContents.send(IPC_CHANNELS.overlay.showUpdate, state);
    this.revealOverlay(overlay);
  }

  updateUpdateOverlay(state: ApplicationUpdatePanelState): void {
    const overlay = this.overlayWindow;
    if (!overlay || overlay.isDestroyed()) return;
    overlay.webContents.send(
      IPC_CHANNELS.application.updateStateChanged,
      state,
    );
  }

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

  toggleOverlay(): void {
    if (this.overlayVisible) {
      const overlay = this.requireOverlayWindow();
      overlay.webContents.send(IPC_CHANNELS.overlay.requestClose);
    } else {
      this.showOverlay();
    }
  }

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
    if (process.platform === 'darwin') app.focus({ steal: true });
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

  private async activateSiteView(
    runtime: SiteRuntimeProfile,
  ): Promise<{ readonly siteSession: Session; readonly webContents: WebContents }> {
    const viewerWindow = this.requireViewerWindow();
    if (this.internalVideoVisible) {
      await this.exitInternalVideoPictureInPicture();
      this.internalVideoVisible = false;
      this.internalVideoPresentation = { ready: false, width: 0, height: 0 };
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
    siteView.webContents.setUserAgent(
      createBrowserUserAgent(siteView.webContents.getUserAgent()),
    );
    this.configureSiteSession(siteSession);
    // Provider injections log with a stable prefix. Forward only those
    // messages instead of every third-party site console line, which keeps
    // the application log useful when diagnosing quality/ad playback.
    attachRendererLogging(
      siteView.webContents,
      `site:${runtime.siteId}`,
      (message) => message.includes('[Kawaikara/'),
    );
    this.attachSiteWebContents(siteView.webContents, siteSession);
    this.applyThemeToRemoteWebContents(siteView.webContents);
    viewerWindow.contentView.addChildView(siteView);
    this.siteViewAttached = true;
    this.syncSiteViewBounds();
    siteView.webContents.focus();
    console.info(
      `Activated ${runtime.siteId} in browser profile ${runtime.id} (${runtime.partition}).`,
    );
    return { siteSession, webContents: siteView.webContents };
  }

  private attachSiteWebContents(
    webContents: WebContents,
    siteSession: Session,
  ): void {
    const webContentsId = webContents.id;
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
      this.applyThemeToRemoteWebContents(webContents);
      void webContents
        .insertCSS(REMOTE_SCROLLBAR_CSS, { cssOrigin: 'user' })
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
      if (this.shortcutHandler?.(input, editing)) event.preventDefault();
    });
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
    webContents.on('did-start-loading', () => {
      this.editingWebContentsIds.delete(webContentsId);
    });
    webContents.on(
      'did-start-navigation',
      (_event, _url, isInPlace, isMainFrame) => {
        // YouTube Shorts and other SPAs reuse the active video element while
        // updating the URL with the History API. Keep PiP attached for those
        // same-document transitions; a real document navigation still exits.
        if (isMainFrame && !isInPlace) void this.pictureInPicture.exitAllModes();
      },
    );
    webContents.on('page-title-updated', (event) => {
      event.preventDefault();
      this.viewerWindow?.setTitle(this.appTitle);
    });
    webContents.on('destroyed', () => {
      this.editingWebContentsIds.delete(webContentsId);
      this.remoteThemeTasks.delete(webContentsId);
      this.remoteThemeCssKeys.delete(webContentsId);
    });

    webContents.setWindowOpenHandler(({ url }) => {
      const action = this.parseSiteAction(url);
      if (action !== undefined) {
        this.dispatchSiteAction(action);
        return { action: 'deny' };
      }
      if (this.navigationGuard && !this.navigationGuard(url)) {
        console.debug(`Blocked guarded site window open: ${url}`);
        return { action: 'deny' };
      }

      const policy = this.newWindowPolicyResolver?.(url) ?? 'viewer';
      switch (policy) {
        case 'external':
          void openInDefaultBrowser(url).catch((error: unknown) => {
            console.error(`Failed to open ${url} in the default browser.`, error);
          });
          return { action: 'deny' };
        case 'viewer':
          void webContents.loadURL(url).catch((error: unknown) => {
            console.error(`Failed to open ${url} in the site viewer.`, error);
          });
          return { action: 'deny' };
        case 'deny':
          return { action: 'deny' };
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
          return { action: 'allow' };
      }
    });

    webContents.on('did-create-window', (popupWindow) => {
      this.sitePopupWindows.add(popupWindow);
      // A site-specific browser UA must also be visible to popup JavaScript.
      // Session request interception covers the initial navigation headers.
      popupWindow.webContents.setUserAgent(webContents.getUserAgent());
      this.applyThemeToRemoteWebContents(popupWindow.webContents);
      popupWindow.setMenuBarVisibility(false);
      popupWindow.on('closed', () => {
        this.sitePopupWindows.delete(popupWindow);
        this.remoteThemeTasks.delete(popupWindow.webContents.id);
        this.remoteThemeCssKeys.delete(popupWindow.webContents.id);
      });
    });
  }

  private applyThemeToRemoteWebContents(webContents: WebContents): void {
    if (webContents.isDestroyed()) return;
    const webContentsId = webContents.id;
    const theme = this.appTheme;
    const previous = this.remoteThemeTasks.get(webContentsId) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(async () => {
      if (webContents.isDestroyed()) return;
      try {
        if (!webContents.debugger.isAttached()) {
          webContents.debugger.attach('1.3');
        }
        await webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
          media: '',
          features: [{ name: 'prefers-color-scheme', value: theme }],
        });
        // Sites without their own prefers-color-scheme rules still receive a
        // Chromium-generated dark palette. Passing false restores their
        // regular light rendering when the app theme changes back.
        await webContents.debugger.sendCommand(
          'Emulation.setAutoDarkModeOverride',
          { enabled: theme === 'dark' },
        );
      } catch (error) {
        console.debug('The site color scheme could not be emulated.', error);
      }

      try {
        const previousCssKey = this.remoteThemeCssKeys.get(webContentsId);
        if (previousCssKey) {
          await webContents.removeInsertedCSS(previousCssKey).catch(() => undefined);
        }
        const cssKey = await webContents.insertCSS(
          `:root { color-scheme: ${theme} !important; }`,
          { cssOrigin: 'user' },
        );
        this.remoteThemeCssKeys.set(webContentsId, cssKey);
      } catch (error) {
        console.debug('The site color-scheme hint could not be applied.', error);
      }
    });
    this.remoteThemeTasks.set(webContentsId, task);
    void task.finally(() => {
      if (this.remoteThemeTasks.get(webContentsId) === task) {
        this.remoteThemeTasks.delete(webContentsId);
      }
    });
  }

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
      const requestHeaders = this.requestHeadersTransformer?.({
        url: details.url,
        method: details.method,
        requestHeaders: details.requestHeaders,
      });
      callback({ requestHeaders: requestHeaders ?? details.requestHeaders });
    });
  }

  private destroySiteView(): void {
    const siteView = this.siteView;
    this.siteView = undefined;
    if (!siteView) return;
    const webContentsId = siteView.webContents.id;
    this.editingWebContentsIds.delete(webContentsId);
    const viewerWindow = this.viewerWindow;
    if (viewerWindow && !viewerWindow.isDestroyed() && this.siteViewAttached) {
      viewerWindow.contentView.removeChildView(siteView);
    }
    this.siteViewAttached = false;
    if (!siteView.webContents.isDestroyed()) siteView.webContents.close();
  }

  private createSiteViewer(webContents: WebContents): SiteViewer {
    const getWebContents = () => {
      if (webContents.isDestroyed()) {
        throw new Error('The site WebContents is no longer active.');
      }
      return webContents;
    };
    const defaultUserAgent = webContents.getUserAgent();

    return {
      loadURL: async (url) => {
        const contents = getWebContents();
        await this.prepareViewerTransition(contents);
        this.currentVideoOpenRequest = null;
        await loadURLWithNavigationRecovery(contents, url);
      },
      loadInternalView: async (viewId) => {
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
        this.internalVideoPresentation = { ready: false, width: 0, height: 0 };
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
      getUserAgent: () => getWebContents().getUserAgent(),
      setUserAgent: (userAgent) => {
        getWebContents().setUserAgent(userAgent ?? defaultUserAgent);
      },
      executeJavaScript: async <T>(code: string) =>
        (await getWebContents().executeJavaScript(code)) as T,
      executeJavaScriptInAllFrames: async <T>(code: string) => {
        const frames = getWebContents().mainFrame.framesInSubtree.filter(
          (frame) => !frame.isDestroyed(),
        );
        const results = await Promise.allSettled(
          frames.map((frame) => frame.executeJavaScript(code)),
        );
        return results.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value as T] : [],
        );
      },
      sendKeyPress: (key) => {
        const contents = getWebContents();
        contents.sendInputEvent({ type: 'keyDown', keyCode: key });
        contents.sendInputEvent({ type: 'keyUp', keyCode: key });
      },
      onDomReady: (listener): Disposable => {
        const webContents = getWebContents();
        const wrapped = () => {
          void Promise.resolve(listener()).catch((error: unknown) => {
            console.error('Site dom-ready hook failed.', error);
          });
        };

        webContents.on('dom-ready', wrapped);
        return {
          dispose: () => {
            if (!webContents.isDestroyed()) {
              webContents.off('dom-ready', wrapped);
            }
          },
        };
      },
      onDidFinishLoad: (listener): Disposable => {
        const webContents = getWebContents();
        const wrapped = () => {
          void Promise.resolve(listener()).catch((error: unknown) => {
            console.error('Site did-finish-load hook failed.', error);
          });
        };

        webContents.on('did-finish-load', wrapped);
        return {
          dispose: () => {
            if (!webContents.isDestroyed()) {
              webContents.off('did-finish-load', wrapped);
            }
          },
        };
      },
      onFrameReady: (listener): Disposable => {
        const webContents = getWebContents();
        const wrapped = () => {
          void Promise.resolve(listener()).catch((error: unknown) => {
            console.error('Site frame-ready hook failed.', error);
          });
        };

        webContents.on('did-frame-finish-load', wrapped);
        return {
          dispose: () => {
            if (!webContents.isDestroyed()) {
              webContents.off('did-frame-finish-load', wrapped);
            }
          },
        };
      },
    };
  }

  private async prepareViewerTransition(webContents: WebContents): Promise<void> {
    await this.exitInternalVideoPictureInPicture();
    await this.pictureInPicture.exitAllModes();
    this.closeSitePopups();
    await prepareCurrentDocumentForNavigation(webContents);
  }

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
      return await this.externalBrowser.login(options, targetSession);
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

  private async cancelExternalLogin(): Promise<void> {
    ++this.externalLoginGeneration;
    await this.externalBrowser.close();
  }

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
    this.siteView.setBounds({ x: 0, y: 0, width, height });
  }

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
          ? { disableBlinkFeatures: 'WebGPU' }
          : {}),
        // electron-mpv-video exposes its renderer bridge from this preload.
        sandbox: false,
      },
    });
    this.videoWindow = video;
    attachRendererLogging(video.webContents, 'video');
    this.mpv.attachWindow(video);
    video.setMenu(null);
    video.setMenuBarVisibility(false);
    const webContentsId = video.webContents.id;
    video.webContents.on('before-input-event', (event, input) => {
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
      const editing = this.editingWebContentsIds.has(webContentsId);
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
        this.internalVideoPresentation = { ready: false, width: 0, height: 0 };
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

  private syncOverlayBounds(): void {
    if (!this.viewerWindow || !this.overlayWindow) {
      return;
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

  private clearOverlayRevealTimer(): void {
    if (this.overlayRevealTimer === undefined) return;
    clearTimeout(this.overlayRevealTimer);
    this.overlayRevealTimer = undefined;
  }

  private closeSitePopups(): void {
    for (const popupWindow of this.sitePopupWindows) {
      if (!popupWindow.isDestroyed()) {
        popupWindow.close();
      }
    }
    this.sitePopupWindows.clear();
  }

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

  private requireViewerWindow(): BrowserWindow {
    if (!this.viewerWindow || this.viewerWindow.isDestroyed()) {
      throw new Error('The site viewer window has not been created.');
    }
    return this.viewerWindow;
  }

  private getActiveViewerWebContents(): WebContents | undefined {
    if (this.internalVideoVisible) return this.videoWindow?.webContents;
    return this.siteView?.webContents;
  }

  private requireActiveViewerWebContents(): WebContents {
    const webContents = this.getActiveViewerWebContents();
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('The active viewer WebContents has not been created.');
    }
    return webContents;
  }

  private requireSiteWebContents(): WebContents {
    return this.requireSiteView().webContents;
  }

  private requireVideoWindow(): BrowserWindow {
    const video = this.videoWindow;
    if (!video || video.isDestroyed()) {
      throw new Error('The Video window has not been created.');
    }
    return video;
  }

  private requireSiteView(): WebContentsView {
    const siteView = this.siteView;
    const webContents = siteView?.webContents;
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('The site viewer WebContentsView has not been created.');
    }
    return siteView;
  }

  private requireOverlayWindow(): BrowserWindow {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      throw new Error('The renderer overlay window has not been created.');
    }
    return this.overlayWindow;
  }
}

function resolveMpvAddonPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mpv', 'mpv_addon.node');
  }
  return path.resolve(
    __dirname,
    '../../node_modules/electron-mpv-video/native/mpv-addon/build/Release/mpv_addon.node',
  );
}

function isExpectedSpaNavigationHandoff(
  error: unknown,
  requestedUrl: string,
  currentUrl: string,
): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code?: unknown }).code !== 'ERR_FAILED'
  ) {
    return false;
  }

  try {
    const requested = new URL(requestedUrl);
    const current = new URL(currentUrl);
    return (
      ['http:', 'https:'].includes(current.protocol) &&
      normalizeNavigationHost(current.hostname) ===
        normalizeNavigationHost(requested.hostname)
    );
  } catch {
    return false;
  }
}

async function prepareCurrentDocumentForNavigation(
  webContents: WebContents,
): Promise<void> {
  if (
    webContents.isDestroyed() ||
    !isScriptableDocumentUrl(webContents.getURL())
  ) {
    return;
  }

  try {
    await webContents.executeJavaScript(PAUSE_DOCUMENT_MEDIA_SCRIPT);
  } catch (error) {
    console.debug('The previous site document was unavailable during media cleanup.', error);
  }

  if (!webContents.isDestroyed()) {
    webContents.stop();
    await delay(32);
  }
}

async function loadURLWithNavigationRecovery(
  webContents: WebContents,
  requestedUrl: string,
): Promise<void> {
  try {
    await webContents.loadURL(requestedUrl);
    return;
  } catch (error) {
    let currentUrl = webContents.getURL();
    if (isExpectedSpaNavigationHandoff(error, requestedUrl, currentUrl)) {
      logExpectedNavigationHandoff(requestedUrl, currentUrl);
      return;
    }
    if (!isRecoverableCrossSiteNavigationFailure(error, requestedUrl, currentUrl)) {
      throw error;
    }

    // Active streaming pages can reject Electron's loadURL promise before the
    // destination commits. Give that hand-off a moment before replacing the
    // old document and retrying once.
    await delay(NAVIGATION_HANDOFF_SETTLE_MS);
    currentUrl = webContents.getURL();
    if (isExpectedSpaNavigationHandoff(error, requestedUrl, currentUrl)) {
      logExpectedNavigationHandoff(requestedUrl, currentUrl);
      return;
    }

    console.warn(
      `Retrying navigation to ${requestedUrl} after the active site rejected the initial hand-off (${currentUrl}).`,
    );
    webContents.stop();
    await webContents.loadURL('about:blank');

    try {
      await webContents.loadURL(requestedUrl);
    } catch (retryError) {
      await delay(NAVIGATION_HANDOFF_SETTLE_MS);
      const retryUrl = webContents.getURL();
      if (isExpectedSpaNavigationHandoff(retryError, requestedUrl, retryUrl)) {
        logExpectedNavigationHandoff(requestedUrl, retryUrl);
        return;
      }
      throw retryError;
    }
  }
}

function isRecoverableCrossSiteNavigationFailure(
  error: unknown,
  requestedUrl: string,
  currentUrl: string,
): boolean {
  if (!hasErrorCode(error, 'ERR_FAILED')) {
    return false;
  }

  try {
    const requested = new URL(requestedUrl);
    const current = new URL(currentUrl);
    return (
      ['http:', 'https:'].includes(requested.protocol) &&
      ['http:', 'https:'].includes(current.protocol) &&
      normalizeNavigationHost(current.hostname) !==
        normalizeNavigationHost(requested.hostname)
    );
  } catch {
    return false;
  }
}

function logExpectedNavigationHandoff(
  requestedUrl: string,
  currentUrl: string,
): void {
  console.debug(
    `Navigation to ${requestedUrl} continued after Electron reported ERR_FAILED (${currentUrl}).`,
  );
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

function isScriptableDocumentUrl(url: string): boolean {
  try {
    return ['file:', 'http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeNavigationHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function createBrowserUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s(?:Electron|kawaikara)\/[^\s]+/gi, '')
    .trim();
}

function resolveLocalizedAppTitle(locale: string): string {
  const language = locale.toLowerCase();
  if (language.startsWith('ko')) return '카와이카라';
  if (language.startsWith('ja')) return 'カワイカラ';
  return 'Kawaikara';
}

function normalizeVideoDimension(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

function resolveInternalVideoPictureInPictureBounds(
  previousBounds: Rectangle,
  preferred: { readonly width: number; readonly height: number },
  preference: PictureInPicturePlacementPreference,
): Rectangle {
  const displays = screen.getAllDisplays();
  const byId = (id: string | undefined) =>
    id ? displays.find((display) => String(display.id) === id) : undefined;
  const current = screen.getDisplayMatching(previousBounds);
  const display = preference.monitor.mode === 'display'
    ? byId(preference.monitor.displayId) ?? current
    : preference.monitor.mode === 'last'
      ? byId(preference.lastPlacement?.displayId) ?? current
      : current;
  const workArea = display.workArea;
  const width = Math.min(preferred.width, workArea.width);
  const height = Math.min(preferred.height, workArea.height);
  const availableWidth = Math.max(0, workArea.width - width);
  const availableHeight = Math.max(0, workArea.height - height);
  if (preference.position === 'last' && preference.lastPlacement) {
    return {
      x: Math.round(workArea.x + availableWidth * preference.lastPlacement.xRatio),
      y: Math.round(workArea.y + availableHeight * preference.lastPlacement.yRatio),
      width,
      height,
    };
  }
  const right = preference.position.endsWith('right');
  const bottom = preference.position.startsWith('bottom');
  return {
    x: right
      ? workArea.x + workArea.width - width - INTERNAL_VIDEO_PIP_MARGIN
      : workArea.x + INTERNAL_VIDEO_PIP_MARGIN,
    y: bottom
      ? workArea.y + workArea.height - height - INTERNAL_VIDEO_PIP_MARGIN
      : workArea.y + INTERNAL_VIDEO_PIP_MARGIN,
    width,
    height,
  };
}

function captureInternalVideoPictureInPicturePlacement(
  viewer: BrowserWindow,
): PictureInPictureLastPlacement | undefined {
  const bounds = viewer.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const availableWidth = Math.max(1, display.workArea.width - bounds.width);
  const availableHeight = Math.max(1, display.workArea.height - bounds.height);
  return {
    displayId: String(display.id),
    xRatio: Math.min(
      1,
      Math.max(0, (bounds.x - display.workArea.x) / availableWidth),
    ),
    yRatio: Math.min(
      1,
      Math.max(0, (bounds.y - display.workArea.y) / availableHeight),
    ),
  };
}
