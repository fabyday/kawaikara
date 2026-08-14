import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  screen,
  session,
  shell,
  type Input,
  type Rectangle,
  type Session,
  type WebContents,
  WebContentsView,
} from 'electron';
import type {
  Disposable,
  NewWindowPolicy,
  SiteContext,
  SiteRequestDetails,
  SiteRequestHeaders,
  SiteExternalBrowser,
  SiteViewer,
} from '@kawaikara/site-api';
import { ExternalBrowserManager } from './ExternalBrowserManager';
import { UnifiedPictureInPictureManager } from './UnifiedPictureInPictureManager';
import type { SiteRuntimeProfile } from './SiteManager';
import {
  IPC_CHANNELS,
  type AppLocale,
  type DisplayInfo,
  type OverlayView,
  type VideoOpenRequest,
} from '../../Common/IPC';
import type {
  PictureInPictureLastPlacement,
  PictureInPicturePlacementPreference,
  PictureInPictureSizePreference,
} from '../../Common/PictureInPicture';

const OVERLAY_WIDTH = 380;
const NAVIGATION_HANDOFF_SETTLE_MS = 180;
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

export class WindowManager {
  private readonly externalBrowser = new ExternalBrowserManager();
  // The previous native/Game PiP implementation remains in
  // PictureInPictureManager.ts as a legacy fallback while the unified,
  // dedicated-window PiP is evaluated.
  private readonly pictureInPicture = new UnifiedPictureInPictureManager(
    () => this.requireViewerWindow(),
    () => this.requireSiteView(),
    (result) => {
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
  private readonly editingWebContentsIds = new Set<number>();
  private readonly sitePopupWindows = new Set<BrowserWindow>();
  private appTitle = 'Kawaikara';
  private viewerWindow?: BrowserWindow;
  private overlayWindow?: BrowserWindow;
  private siteView?: WebContentsView;
  private readonly configuredSiteSessions = new WeakSet<Session>();
  private overlayVisible = false;
  private overlayView: OverlayView = 'menu';
  private closeMenuOnEscape = true;
  private closeMenuOnOutsideClick = true;
  private currentVideoOpenRequest: VideoOpenRequest | null = null;
  private pendingVideoOpenRequest?: VideoOpenRequest;
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
  private pictureInPicturePlacementRecorder?: (
    placement: PictureInPictureLastPlacement,
  ) => Promise<void> | void;
  private restoringPictureInPicture = false;

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
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const overlayWindow = new BrowserWindow({
      parent: viewerWindow,
      width: OVERLAY_WIDTH,
      height: 800,
      show: false,
      frame: false,
      transparent: true,
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
      },
    });

    this.viewerWindow = viewerWindow;
    this.overlayWindow = overlayWindow;
    viewerWindow.setMenu(null);
    viewerWindow.setMenuBarVisibility(false);
    const overlayWebContentsId = overlayWindow.webContents.id;
    this.syncSiteViewBounds();
    this.syncOverlayBounds();

    viewerWindow.on('move', () => {
      this.syncSiteViewBounds();
      this.syncOverlayBounds();
    });
    viewerWindow.on('resize', () => {
      this.syncSiteViewBounds();
      this.syncOverlayBounds();
    });
    viewerWindow.on('close', (event) => {
      if (this.pictureInPicture.isActive()) {
        event.preventDefault();
        void this.restorePictureInPicture();
      }
    });
    viewerWindow.on('closed', () => {
      this.pictureInPicture.handleViewerClosed();
      const siteWebContentsId = this.siteView?.webContents.id;
      if (siteWebContentsId) this.editingWebContentsIds.delete(siteWebContentsId);
      this.editingWebContentsIds.delete(overlayWebContentsId);
      this.destroySiteView();
      this.viewerWindow = undefined;
      this.overlayWindow = undefined;
      this.overlayVisible = false;
    });

    overlayWindow.webContents.on('before-input-event', (event, input) => {
      const editing = this.editingWebContentsIds.has(overlayWebContentsId);
      if (
        this.overlayVisible &&
        this.overlayView === 'preference' &&
        input.type === 'keyDown' &&
        !input.isAutoRepeat &&
        !input.isComposing
      ) {
        const key = input.key.toLowerCase();
        const plainKey =
          !input.control && !input.meta && !input.alt && !input.shift;
        if (
          plainKey &&
          (key === 'escape' || (key === 'backspace' && !editing))
        ) {
          event.preventDefault();
          this.showOverlay();
          return;
        }

        // Preference owns its keyboard navigation. In particular, Tab must
        // move focus instead of reaching the app.toggle-menu shortcut.
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
    overlayWindow.on('blur', () => {
      if (
        this.overlayVisible &&
        this.overlayView === 'menu' &&
        this.closeMenuOnOutsideClick
      ) {
        overlayWindow.webContents.send(IPC_CHANNELS.overlay.requestClose);
      }
    });
  }

  setSiteHandlers(handlers: {
    resolveNewWindowPolicy(url: string): NewWindowPolicy;
    handleAction(action: string): Promise<boolean>;
    allowNavigation(url: string): boolean;
    allowPictureInPicture(url: string): boolean;
    transformRequestHeaders(
      details: SiteRequestDetails,
    ): SiteRequestHeaders | undefined;
  }): void {
    this.newWindowPolicyResolver = handlers.resolveNewWindowPolicy;
    this.siteActionHandler = handlers.handleAction;
    this.navigationGuard = handlers.allowNavigation;
    this.pictureInPictureGuard = handlers.allowPictureInPicture;
    this.requestHeadersTransformer = handlers.transformRequestHeaders;
  }

  setShortcutHandler(handler: (input: Input, editing: boolean) => boolean): void {
    this.shortcutHandler = handler;
  }

  setPictureInPictureStateHandler(handler: (active: boolean) => void): void {
    this.pictureInPictureStateHandler = handler;
    handler(this.pictureInPicture.isActive());
  }

  async dispose(): Promise<void> {
    await this.pictureInPicture.exitAllModes();
    await this.cancelExternalLogin();
    this.closeSitePopups();
    this.newWindowPolicyResolver = undefined;
    this.siteActionHandler = undefined;
    this.navigationGuard = undefined;
    this.pictureInPictureGuard = undefined;
    this.pictureInPictureStateHandler = undefined;
    this.requestHeadersTransformer = undefined;
    this.shortcutHandler = undefined;
    this.destroySiteView();
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
      this.pendingVideoOpenRequest = {
        kind: 'local',
        displayName: path.basename(filePath),
        url: pathToFileURL(filePath).href,
      };
      return true;
    }
    return false;
  }

  queueYouTubeDownloader(url: string): void {
    this.pendingVideoOpenRequest = { kind: 'youtube', url };
  }

  getCurrentVideoOpenRequest(): VideoOpenRequest | null {
    return this.currentVideoOpenRequest;
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
      openExternal: (url) => shell.openExternal(url),
    };
  }

  setAlwaysOnTop(enabled: boolean): void {
    this.viewerWindow?.setAlwaysOnTop(enabled);
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

  setPictureInPictureSize(preference: PictureInPictureSizePreference): void {
    this.pictureInPicture.setWindowSize(preference);
  }

  setPictureInPicturePortraitSize(
    preference: PictureInPictureSizePreference,
  ): void {
    this.pictureInPicture.setPortraitWindowSize(preference);
  }

  setPictureInPicturePlacement(
    preference: PictureInPicturePlacementPreference,
  ): void {
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
    if (!this.canEnterPictureInPicture()) {
      return { status: 'no-video' as const, mode: 'video' as const };
    }
    return this.togglePictureInPictureWithOverlay(() =>
      this.pictureInPicture.toggle(),
    );
  }

  async toggleGamePictureInPicture() {
    if (!this.canEnterPictureInPicture()) {
      return { status: 'no-video' as const, mode: 'window' as const };
    }
    return this.togglePictureInPictureWithOverlay(() =>
      this.pictureInPicture.toggle(),
    );
  }

  private canEnterPictureInPicture(): boolean {
    if (this.pictureInPicture.isActive()) return true;
    const webContents = this.requireSiteWebContents();
    return this.pictureInPictureGuard?.(webContents.getURL()) ?? true;
  }

  private async togglePictureInPictureWithOverlay(
    toggle: () => ReturnType<UnifiedPictureInPictureManager['toggle']>,
  ) {
    const overlayWasVisible = this.overlayVisible;
    if (overlayWasVisible) this.hideOverlay();

    const result = await toggle();
    if (result.status === 'exited') {
      this.focusViewer();
    } else if (overlayWasVisible && result.status !== 'entered') {
      this.showOverlay();
    }
    return result;
  }

  private async restorePictureInPicture(): Promise<void> {
    if (this.restoringPictureInPicture) return;
    this.restoringPictureInPicture = true;
    try {
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
    const resolvedLocale = locale === 'system' ? systemLocale : locale;
    this.appTitle = resolveLocalizedAppTitle(resolvedLocale);
    this.viewerWindow?.setTitle(this.appTitle);
  }

  toggleAppFullScreen(): void {
    const viewer = this.requireViewerWindow();
    viewer.setFullScreen(!viewer.isFullScreen());
  }

  reloadViewer(): void {
    this.requireSiteWebContents().reload();
  }

  goBack(): void {
    const navigation = this.requireSiteWebContents().navigationHistory;
    if (navigation.canGoBack()) navigation.goBack();
  }

  goForward(): void {
    const navigation = this.requireSiteWebContents().navigationHistory;
    if (navigation.canGoForward()) navigation.goForward();
  }

  setEditingState(webContentsId: number, editing: boolean): boolean {
    const viewerId = this.siteView?.webContents.id;
    const overlayId = this.overlayWindow?.webContents.id;
    if (webContentsId !== viewerId && webContentsId !== overlayId) {
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
    overlay.show();
    overlay.focus();
    overlay.webContents.send(IPC_CHANNELS.overlay.showMenu);
  }

  showPreferencesOverlay(): void {
    const overlay = this.requireOverlayWindow();
    this.overlayView = 'preference';
    this.syncOverlayBounds();
    this.overlayVisible = true;
    overlay.show();
    overlay.focus();
    overlay.webContents.send(IPC_CHANNELS.overlay.showPreferences);
  }

  hideOverlay(): void {
    this.overlayVisible = false;
    const overlay = this.overlayWindow;
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send(IPC_CHANNELS.overlay.hidden);
      overlay.hide();
    }
    this.viewerWindow?.focus();
    if (this.siteView && !this.siteView.webContents.isDestroyed()) {
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
    if (process.platform === 'darwin') app.focus({ steal: true });
    viewer.moveTop();
    viewer.focus();
    this.siteView?.webContents.focus();
  }

  private async activateSiteView(
    runtime: SiteRuntimeProfile,
  ): Promise<{ readonly siteSession: Session; readonly webContents: WebContents }> {
    if (this.siteView && !this.siteView.webContents.isDestroyed()) {
      await this.pictureInPicture.exitAllModes();
      await prepareCurrentDocumentForNavigation(this.siteView.webContents);
    }
    await this.cancelExternalLogin();
    this.closeSitePopups();
    this.destroySiteView();

    const viewerWindow = this.requireViewerWindow();
    const siteSession = session.fromPartition(runtime.partition);
    const siteView = new WebContentsView({
      webPreferences: {
        session: siteSession,
        preload: path.resolve(__dirname, '../preload/viewer.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // HTML5 fullscreen stays inside the host window. Native app fullscreen
        // remains an explicit Kawaikara shortcut.
        disableHtmlFullscreenWindowResize: true,
      },
    });

    this.siteView = siteView;
    this.configureSiteSession(siteSession);
    this.attachSiteWebContents(siteView.webContents, siteSession);
    viewerWindow.contentView.addChildView(siteView);
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
          void shell.openExternal(url);
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
      popupWindow.setMenuBarVisibility(false);
      popupWindow.on('closed', () => this.sitePopupWindows.delete(popupWindow));
    });
  }

  private configureSiteSession(siteSession: Session): void {
    if (this.configuredSiteSessions.has(siteSession)) return;
    this.configuredSiteSessions.add(siteSession);
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
    if (viewerWindow && !viewerWindow.isDestroyed()) {
      viewerWindow.contentView.removeChildView(siteView);
    }
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
        const request = this.pendingVideoOpenRequest;
        this.pendingVideoOpenRequest = undefined;
        this.currentVideoOpenRequest = request ?? null;
        await contents.loadFile(
          path.resolve(__dirname, '../renderer/video.html'),
        );
        if (request) {
          contents.send(
            IPC_CHANNELS.video.openRequestChanged,
            request,
          );
        }
      },
      getUserAgent: () => getWebContents().getUserAgent(),
      setUserAgent: (userAgent) => {
        getWebContents().setUserAgent(userAgent ?? defaultUserAgent);
      },
      executeJavaScript: async <T>(code: string) =>
        (await getWebContents().executeJavaScript(code)) as T,
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
    };
  }

  private async prepareViewerTransition(webContents: WebContents): Promise<void> {
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
          site: options.siteTitle ?? '',
          locale: options.locale ?? '',
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
      this.pictureInPicture.isActive()
    ) {
      return;
    }
    const [width, height] = this.viewerWindow.getContentSize();
    this.siteView.setBounds({ x: 0, y: 0, width, height });
  }

  private syncOverlayBounds(): void {
    if (!this.viewerWindow || !this.overlayWindow) {
      return;
    }

    const contentBounds = this.viewerWindow.getContentBounds();
    const bounds: Rectangle = {
      x: contentBounds.x,
      y: contentBounds.y,
      width:
        this.overlayView === 'preference'
          ? contentBounds.width
          : Math.min(OVERLAY_WIDTH, contentBounds.width),
      height: contentBounds.height,
    };
    this.overlayWindow.setBounds(bounds, false);
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

  private requireSiteWebContents(): WebContents {
    return this.requireSiteView().webContents;
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
    await webContents.executeJavaScript(`
      (() => {
        const mediaElements = document.querySelectorAll('audio, video');
        mediaElements.forEach((media) => {
          media.autoplay = false;
          media.pause();
        });
        return mediaElements.length;
      })()
    `);
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

function resolveLocalizedAppTitle(locale: string): string {
  const language = locale.toLowerCase();
  if (language.startsWith('ko')) return '카와이카라';
  if (language.startsWith('ja')) return 'カワイカラ';
  return 'Kawaikara';
}
