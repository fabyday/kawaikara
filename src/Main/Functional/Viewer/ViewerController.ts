import type { ExternalAppSetupRequest } from '../../../Common/Download';
import {
    app,
    BrowserWindow,
    nativeTheme,
    screen,
    WebContentsView,
    type Rectangle,
    type WebContents,
} from 'electron';
import path from 'node:path';
import {
    IPC_CHANNELS,
    type ApplicationUpdatePanelState,
    type AppLocale,
    type AppTheme,
    type DevelopmentState,
    type DisplayInfo,
    type OverlayView,
    type VideoPresentationState,
} from '../../../Common/IPC';
import type { SiteTransitionState } from '../../../Common/SiteTransition';
import { getLocaleMessages } from '../Localization/Locale';
import { getAppMessages } from '../Localization/RendererMessages';
import { DetachableWindowSurface } from '../Window/DetachableWindowSurface';
import {
    bindAppSurfaceEvents,
    bindViewerWindowEvents,
} from '../Window/ViewerWindowEvents';
import { type WindowInputSurface } from '../Window/WindowInput';
import type { InternalVideoPictureInPictureState } from '../Window/WindowRuntime';
import { attachWindowSurface } from '../Window/WindowSurfaceHost';
import {
    createSiteTransitionSurfaceHtml,
    createUpdateSiteTransitionSurfaceScript,
} from '../../Inject/SiteTransitionSurface';
import {
    activateApplication,
    restoreApplicationPresentation,
} from '../../Platform/Presentation';
import type { LoggingManager } from '../../Manager/LoggingManager';
/** Capabilities used by ViewerController; values are resolved from their owner at dispatch time. */
export interface ViewerControllerHost {
    /** Reads viewerWindow from its owner. */
    readonly viewerWindow: BrowserWindow | undefined;
    /** Requests createNativeWindow from its owner. */
    readonly createNativeWindow: (
        title: string,
        backgroundColor: string,
    ) => BrowserWindow;
    /** Reads disposing from its owner. */
    disposing: boolean;
    /** Reads viewerClosePrepared from its owner. */
    viewerClosePrepared: boolean;
    /** Requests syncSiteViewBounds from its owner. */
    readonly syncSiteViewBounds: () => void;
    /** Requests syncVideoViewBounds from its owner. */
    readonly syncVideoViewBounds: () => void;
    /** Requests refreshExternalFullscreenState from its owner. */
    readonly refreshExternalFullscreenState: (
        reassertPresentation?: boolean,
        deferRestoration?: boolean,
    ) => void;
    /** Reads videoView from its owner. */
    readonly videoView: WebContentsView | undefined;
    /** Reads logViewer from its owner. */
    readonly logViewer: DetachableWindowSurface;
    /** Requests focusInternalVideoView from its owner. */
    readonly focusInternalVideoView: () => void;
    /** Requests navigateVideoDirectory from its owner. */
    readonly navigateVideoDirectory: (direction: 'back' | 'forward') => void;
    /** Reads viewerClosePreparation from its owner. */
    viewerClosePreparation: Promise<void> | undefined;
    /** Requests prepareViewerWindowClose from its owner. */
    readonly prepareViewerWindowClose: (viewer: BrowserWindow) => Promise<void>;
    /** Requests handleViewerClosed from its owner. */
    readonly handleViewerClosed: (
        viewerWindow: BrowserWindow,
        overlaySurface: WebContentsView,
    ) => void;
    /** Requests connectWindowInput from its owner. */
    readonly connectWindowInput: (
        contents: WebContents,
        surface: WindowInputSurface,
    ) => () => void;
    /** Reads editingWebContentsIds from its owner. */
    readonly editingWebContentsIds: Set<number>;
    /** Requests requireViewerWindow from its owner. */
    readonly requireViewerWindow: () => BrowserWindow;
    /** Reads siteView from its owner. */
    readonly siteView: WebContentsView | undefined;
    /** Reads siteViewAttached from its owner. */
    readonly siteViewAttached: boolean;
    /** Reads siteViewSiteId from its owner. */
    readonly siteViewSiteId: string | undefined;
    /** Reads internalVideoPictureInPicture from its owner. */
    readonly internalVideoPictureInPicture:
        InternalVideoPictureInPictureState | undefined;
    /** Requests exitPictureInPictureForTransition from its owner. */
    readonly exitPictureInPictureForTransition: (
        notify?: boolean,
    ) => Promise<void>;
    /** Reads internalVideoPresentation from its owner. */
    internalVideoPresentation: VideoPresentationState;
    /** Requests setInternalVideoSiteVisibility from its owner. */
    readonly setInternalVideoSiteVisibility: (
        video: WebContentsView,
        visible: boolean,
    ) => void;
}

/** Owns viewer state and lifecycle independently of application composition. */
export class ViewerController {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Cross-feature capabilities. */ private readonly host: ViewerControllerHost,
        /** Renderer logging service. */ private readonly logging: LoggingManager,
    ) {
        this.logger = logging.getLogger('windowManager');
    }

    /** The app title value. */
    appTitle = getAppMessages('system', app.getLocale()).title;

    /** The app locale value. */
    appLocale: AppLocale = 'system';

    /** The app theme value. */
    appTheme: AppTheme = 'dark';

    /** The system locale value. */
    systemLocale = 'en-US';

    /** The retained Menu, Preferences, and Update renderer. */
    overlaySurface?: WebContentsView;

    /** Latest queued Provider lifecycle feedback. */
    siteTransitionState?: SiteTransitionState;

    /** Initial app-owned backing-page navigation, independent of remote sites. */
    siteTransitionSurfaceReady?: Promise<boolean>;

    /** Rejects stale asynchronous backing-page updates. */
    siteTransitionSurfaceRevision = 0;

    /** Start time used to diagnose blank-surface latency without logging URLs. */
    siteTransitionStartedAt = 0;

    /** The internal video visible value. */
    internalVideoVisible = false;

    /** The overlay visible value. */
    overlayVisible = false;

    /** The overlay view value. */
    overlayView: OverlayView = 'menu';

    /** The restore menu after picture in picture value. */
    restoreMenuAfterPictureInPicture = false;

    /** The close menu on escape value. */
    closeMenuOnEscape = true;

    /** The close menu on outside click value. */
    closeMenuOnOutsideClick = true;

    /** The overlay reveal timer value. */
    overlayRevealTimer?: ReturnType<typeof setTimeout>;

    /** Creates the Windows. */
    createWindows(): void {
        if (this.host.viewerWindow) {
            return;
        }

        const viewerWindow = this.host.createNativeWindow(
            this.appTitle,
            this.getViewerSurfaceColor(),
        );

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
        attachWindowSurface(viewerWindow, overlaySurface);

        this.overlaySurface = overlaySurface;
        this.host.disposing = false;
        this.host.viewerClosePrepared = false;
        this.logging.attachRenderer(viewerWindow.webContents, 'rendererViewer');
        this.siteTransitionSurfaceReady = viewerWindow
            .loadURL(
                `data:text/html;charset=utf-8,${encodeURIComponent(createSiteTransitionSurfaceHtml(this.appTheme))}`,
            )
            .then(
                () => true,
                (error: unknown) => {
                    this.logger.warn(
                        'The app-owned site transition surface could not be loaded.',
                        error,
                    );
                    return false;
                },
            );
        void this.siteTransitionSurfaceReady.then(() =>
            this.renderSiteTransitionSurface(),
        );
        this.logging.attachRenderer(
            overlaySurface.webContents,
            'rendererOverlay',
        );
        viewerWindow.setMenu(null);
        viewerWindow.setMenuBarVisibility(false);
        const overlayWebContentsId = overlaySurface.webContents.id;
        const viewerWebContentsId = viewerWindow.webContents.id;
        this.host.syncSiteViewBounds();
        this.host.syncVideoViewBounds();
        this.syncOverlayBounds();

        bindViewerWindowEvents(viewerWindow, {
            layout: () => {
                this.host.syncSiteViewBounds();
                this.host.syncVideoViewBounds();
                this.syncOverlayBounds();
            },
            refreshStacking: (force) =>
                this.host.refreshExternalFullscreenState(force),
            topmostChanged: (isAlwaysOnTop) => {
                this.logger.info(
                    `Electron always-on-top state changed: ${String(isAlwaysOnTop)}.`,
                );
            },
            fullScreenChanged: (fullScreen) => {
                const videoView = this.host.videoView;
                if (videoView && !videoView.webContents.isDestroyed())
                    videoView.webContents.send(
                        IPC_CHANNELS.application.fullScreenChanged,
                        fullScreen,
                    );
            },
            visible: (reason) => this.refreshActiveContentSurface(reason),
            focused: () => {
                this.host.refreshExternalFullscreenState();
                if (this.host.logViewer.focusEmbedded()) return;
                // Restore keyboard focus to the active Video view after host activation.
                if (!this.internalVideoVisible || this.overlayVisible) return;
                setTimeout(() => this.host.focusInternalVideoView(), 0);
            },
            navigate: (direction) =>
                this.host.navigateVideoDirectory(direction),
            shouldDeferClose: () =>
                !this.host.disposing && !this.host.viewerClosePrepared,
            prepareClose: () => {
                if (!this.host.viewerClosePreparation)
                    this.host.viewerClosePreparation =
                        this.host.prepareViewerWindowClose(viewerWindow);
            },
            closed: () =>
                this.host.handleViewerClosed(viewerWindow, overlaySurface),
        });

        this.host.connectWindowInput(overlaySurface.webContents, 'overlay');

        bindAppSurfaceEvents(overlaySurface.webContents, {
            loading: () =>
                this.host.editingWebContentsIds.delete(overlayWebContentsId),
        });
        this.host.connectWindowInput(viewerWindow.webContents, 'viewer');
        bindAppSurfaceEvents(viewerWindow.webContents, {
            loading: () =>
                this.host.editingWebContentsIds.delete(viewerWebContentsId),
            titleChanged: () => viewerWindow.setTitle(this.appTitle),
        });
    }

    /** Loads the overlay. */
    async loadOverlay(): Promise<void> {
        const overlay = this.requireOverlaySurface();
        await overlay.webContents.loadFile(
            path.resolve(__dirname, '../renderer/index.html'),
        );
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
        const viewerBounds = this.host.requireViewerWindow().getBounds();
        const currentDisplayId = String(
            screen.getDisplayMatching(viewerBounds).id,
        );
        const primaryDisplayId = String(screen.getPrimaryDisplay().id);
        return screen.getAllDisplays().map((display, index) => ({
            id: String(display.id),
            label:
                display.label.trim() ||
                `${getLocaleMessages(this.appLocale, this.systemLocale).app.pipMonitorDisplay} ${String(index + 1)}`,
            width: display.size.width,
            height: display.size.height,
            workArea: { ...display.workArea },
            scaleFactor: display.scaleFactor,
            primary: String(display.id) === primaryDisplayId,
            current: String(display.id) === currentDisplayId,
        }));
    }

    /** Sets the app locale. */
    setAppLocale(locale: AppLocale, systemLocale: string): void {
        this.appLocale = locale;
        this.host.logViewer.notifyState();
        this.systemLocale = systemLocale;
        this.appTitle = getAppMessages(locale, systemLocale).title;
        this.host.viewerWindow?.setTitle(this.appTitle);
        this.renderSiteTransitionSurface();
    }

    /** Performs the reload viewer operation. */
    reloadViewer(): void {
        this.requireActiveViewerWebContents().reload();
    }

    /** Sets the app theme. */
    setAppTheme(theme: AppTheme): void {
        this.appTheme = theme;
        this.host.logViewer.notifyState();
        // Electron propagates this value to every current and future renderer as
        // the native prefers-color-scheme media query. Do not replace it with a
        // DevTools emulation override: a persistent override prevents renderers
        // from receiving subsequent native theme changes.
        nativeTheme.themeSource = theme;
        this.host.viewerWindow?.setBackgroundColor(
            this.getViewerSurfaceColor(),
        );
        this.host.siteView?.setBackgroundColor(this.getViewerSurfaceColor());
        this.renderSiteTransitionSurface();
    }

    /** Returns the native backing color shown between Provider documents. */
    getViewerSurfaceColor(): string {
        return this.appTheme === 'light' ? '#f4f4f5' : '#09090b';
    }

    /** Tracks handoff timing, retaining the outgoing view until native replacement. */
    notifySiteTransition(state: SiteTransitionState): void {
        this.siteTransitionState = state;
        if (state.phase === 'loading')
            this.siteTransitionStartedAt = Date.now();
        if (state.phase === 'failed') this.host.siteView?.setVisible(false);
        const contents = this.host.siteView?.webContents;
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
    renderSiteTransitionSurface(): void {
        const viewer = this.host.viewerWindow;
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
        void ready
            .then((loaded) => {
                if (
                    !loaded ||
                    viewer.isDestroyed() ||
                    revision !== this.siteTransitionSurfaceRevision
                )
                    return;
                return viewer.webContents.executeJavaScript(source);
            })
            .catch((error: unknown) => {
                if (!viewer.isDestroyed())
                    this.logger.debug(
                        'Site transition feedback could not be updated.',
                        error,
                    );
            });
    }

    /** Presents the active document at DOM readiness, not after slow subresources finish. */
    revealActiveSiteView(contents: WebContents, reason: string): void {
        const view = this.host.siteView;
        const transition = this.siteTransitionState;
        if (
            !view ||
            view.webContents !== contents ||
            !this.host.siteViewAttached ||
            this.internalVideoVisible ||
            contents.isDestroyed() ||
            transition?.phase === 'failed' ||
            (transition?.phase === 'loading' &&
                transition.siteId !== this.host.siteViewSiteId) ||
            !contents.getURL() ||
            contents.getURL() === 'about:blank'
        )
            return;
        if (!view.getVisible()) {
            view.setVisible(true);
            contents.invalidate();
            this.logger.debug('Presented active site content.', {
                /** Application lifecycle event that made content presentable. */
                reason,
                /** Time to first presentable main-frame DOM. */
                elapsedMs: Date.now() - this.siteTransitionStartedAt,
            });
            if (!this.overlayVisible && !this.host.logViewer.focusEmbedded())
                contents.focus();
        }
    }

    /** Determines whether the app full screen condition applies. */
    isAppFullScreen(): boolean {
        return (
            !this.host.internalVideoPictureInPicture &&
            this.host.requireViewerWindow().isFullScreen()
        );
    }

    /** Notifies the development state changed. */
    notifyDevelopmentStateChanged(state: DevelopmentState): void {
        const overlay = this.overlaySurface;
        if (overlay && !overlay.webContents.isDestroyed()) {
            overlay.webContents.send(
                IPC_CHANNELS.development.stateChanged,
                state,
            );
        }
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
        // Prepare only the shell while settings are open; log polling starts on presentation.
        void this.host.logViewer.prepare().catch(() => undefined);
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

    /** Presents permission consent without opening the menu or preferences. */
    showExternalAppApproval(): void {
        const overlay = this.requireOverlaySurface();
        this.overlayView = 'external-app-permission';
        this.overlayVisible = true;
        this.syncOverlayBounds();
        overlay.webContents.send(IPC_CHANNELS.overlay.showExternalAppApproval);
        this.revealOverlay(overlay);
    }

    /** Presents setup without switching, reloading or replacing the active Provider surface. */
    showExternalAppOverlay(request: ExternalAppSetupRequest): void {
        const overlay = this.requireOverlaySurface();
        this.overlayView = 'external-app';
        this.overlayVisible = true;
        this.syncOverlayBounds();
        overlay.webContents.send(IPC_CHANNELS.overlay.showExternalApp, request);
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
        this.host.viewerWindow?.focus();
        if (!this.host.logViewer.focusEmbedded())
            this.focusUnderlyingLogViewer();
    }

    /** Closing a log viewer must not create menu/preferences or focus a hidden surface. */
    focusUnderlyingLogViewer(): void {
        const contents = this.overlayVisible
            ? this.overlaySurface?.webContents
            : this.getActiveViewerWebContents();
        if (contents && !contents.isDestroyed()) contents.focus();
    }

    /** Prepares the overlay for picture in picture. */
    prepareOverlayForPictureInPicture(): boolean {
        if (this.overlayVisible && this.overlayView !== 'menu') return false;
        this.restoreMenuAfterPictureInPicture =
            this.overlayVisible && this.overlayView === 'menu';
        if (this.restoreMenuAfterPictureInPicture) this.hideOverlay();
        return true;
    }

    /** Restores the overlay after picture in picture. */
    restoreOverlayAfterPictureInPicture(): void {
        if (!this.restoreMenuAfterPictureInPicture) return;
        this.restoreMenuAfterPictureInPicture = false;
        this.showOverlay();
    }

    /** Toggles the overlay. */
    toggleOverlay(): void {
        if (this.overlayVisible) {
            const overlay = this.requireOverlaySurface();
            overlay.webContents.send(
                IPC_CHANNELS.overlay.requestClose,
                'toggle',
            );
        } else {
            this.showOverlay();
        }
    }

    /** Performs the focus viewer operation. */
    focusViewer(): void {
        const viewer = this.host.requireViewerWindow();
        this.hideOverlay();
        void restoreApplicationPresentation();
        if (viewer.isMinimized()) {
            viewer.restore();
        }
        viewer.show();
        this.host.syncSiteViewBounds();
        this.host.syncVideoViewBounds();
        activateApplication();
        viewer.moveTop();
        viewer.focus();
        if (!this.host.logViewer.focusEmbedded())
            this.focusUnderlyingLogViewer();
    }

    /** Re-presents the active Chromium surface after native window activation. */
    refreshActiveContentSurface(reason: string): void {
        setTimeout(() => {
            const viewer = this.host.viewerWindow;
            if (!viewer || viewer.isDestroyed() || !viewer.isVisible()) return;
            this.host.syncSiteViewBounds();
            this.host.syncVideoViewBounds();
            viewer.webContents.invalidate();

            if (this.internalVideoVisible) {
                const video = this.host.videoView;
                if (
                    video &&
                    !video.webContents.isDestroyed() &&
                    video.getVisible()
                ) {
                    video.webContents.invalidate();
                }
            } else {
                const siteView = this.host.siteView;
                if (
                    this.host.siteViewAttached &&
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
            this.logger.debug(
                `Refreshed the active compositor surface (${reason}).`,
            );
        }, 0);
    }

    /** Performs the sync overlay bounds operation. */
    syncOverlayBounds(): void {
        if (!this.host.viewerWindow || !this.overlaySurface) {
            return;
        }

        const parent = this.host.viewerWindow;
        if (this.overlayVisible) {
            // Site changes can attach a new view after the retained overlay.
            attachWindowSurface(parent, this.overlaySurface);
        }
        const [width, height] = parent.getContentSize();
        const bounds: Rectangle = {
            x: 0,
            y: 0,
            width,
            height,
        };
        this.overlaySurface.setBounds(bounds);
        this.host.logViewer.layout();
    }

    /** Performs the reveal overlay operation. */
    revealOverlay(overlay: WebContentsView): void {
        this.clearOverlayRevealTimer();
        if (overlay.getVisible()) {
            this.host.viewerWindow?.focus();
            if (!this.host.logViewer.focusEmbedded())
                overlay.webContents.focus();
            return;
        }

        // The renderer stays alive while hidden. Give React/Motion two frames to
        // commit the off-screen entry pose before exposing the view, so a
        // completed menu frame cannot flash during a site navigation.
        this.overlayRevealTimer = setTimeout(() => {
            this.overlayRevealTimer = undefined;
            if (!this.overlayVisible || overlay.webContents.isDestroyed())
                return;
            overlay.setVisible(true);
            this.host.viewerWindow?.focus();
            if (!this.host.logViewer.focusEmbedded())
                overlay.webContents.focus();
        }, 34);
    }

    /** Clears the overlay reveal timer. */
    clearOverlayRevealTimer(): void {
        if (this.overlayRevealTimer === undefined) return;
        clearTimeout(this.overlayRevealTimer);
        this.overlayRevealTimer = undefined;
    }

    /** Returns the active viewer web contents. */
    getActiveViewerWebContents(): WebContents | undefined {
        if (this.internalVideoVisible) return this.host.videoView?.webContents;
        return this.host.siteView?.webContents;
    }

    /** Performs the require active viewer web contents operation. */
    requireActiveViewerWebContents(): WebContents {
        const webContents = this.getActiveViewerWebContents();
        if (!webContents || webContents.isDestroyed()) {
            throw new Error(
                'The active viewer WebContents has not been created.',
            );
        }
        return webContents;
    }

    /** Returns the retained app-owned overlay view. */
    requireOverlaySurface(): WebContentsView {
        if (
            !this.overlaySurface ||
            this.overlaySurface.webContents.isDestroyed()
        ) {
            throw new Error('The renderer overlay view has not been created.');
        }
        return this.overlaySurface;
    }

    /** Suspends the outgoing content before a Provider activates a site surface. */
    async prepareForSiteActivation(): Promise<void> {
        await this.host.exitPictureInPictureForTransition();
        if (this.internalVideoVisible) {
            this.internalVideoVisible = false;
            this.host.internalVideoPresentation = {
                ready: false,
                width: 0,
                height: 0,
            };
            const video = this.host.videoView;
            if (video && !video.webContents.isDestroyed()) {
                this.host.setInternalVideoSiteVisibility(video, false);
            }
        }
    }
}
