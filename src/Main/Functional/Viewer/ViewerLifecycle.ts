import type {
    NewWindowPolicy,
    SiteRequestDetails,
    SiteRequestHeaders,
    SiteRequestRedirect,
} from '@kawaikara/site-api';
import { BrowserWindow, session, WebContentsView, type Input } from 'electron';
import { completeCleanup } from '../App/Cleanup';
import { DetachableWindowSurface } from '../Window/DetachableWindowSurface';
import type { InternalVideoPictureInPictureState } from '../Window/WindowRuntime';
import { detachWindowSurface } from '../Window/WindowSurfaceHost';
import type { LoggingManager } from '../../Manager/LoggingManager';
import { UnifiedPictureInPictureManager } from '../../Manager/UnifiedPictureInPictureManager';
/** Capabilities used by ViewerLifecycle; values are resolved from their owner at dispatch time. */
export interface ViewerLifecycleHost {
    /** Requests recordAppWindowPosition from its owner. */
    readonly recordAppWindowPosition: () => Promise<void>;
    /** Reads logViewer from its owner. */
    readonly logViewer: DetachableWindowSurface;
    /** Requests stopExternalFullscreenMonitoring from its owner. */
    readonly stopExternalFullscreenMonitoring: () => void;
    /** Requests stopVideoInitialization from its owner. */
    readonly stopVideoInitialization: () => void;
    /** Requests exitPictureInPictureForTransition from its owner. */
    readonly exitPictureInPictureForTransition: (
        notify?: boolean,
    ) => Promise<void>;
    /** Requests cancelExternalLogin from its owner. */
    readonly cancelExternalLogin: (waitForCleanup?: boolean) => Promise<void>;
    /** Requests closeSitePopups from its owner. */
    readonly closeSitePopups: () => void;
    /** Reads newWindowPolicyResolver from its owner. */
    newWindowPolicyResolver: ((url: string) => NewWindowPolicy) | undefined;
    /** Reads siteActionHandler from its owner. */
    siteActionHandler: ((action: string) => Promise<boolean>) | undefined;
    /** Reads navigationGuard from its owner. */
    navigationGuard: ((url: string) => boolean) | undefined;
    /** Reads pictureInPictureGuard from its owner. */
    pictureInPictureGuard: ((url: string) => boolean) | undefined;
    /** Reads pictureInPictureContentOverlaySelectors from its owner. */
    pictureInPictureContentOverlaySelectors:
        (() => readonly string[]) | undefined;
    /** Reads pictureInPicture from its owner. */
    readonly pictureInPicture: UnifiedPictureInPictureManager;
    /** Reads pictureInPictureStateHandler from its owner. */
    pictureInPictureStateHandler: ((active: boolean) => void) | undefined;
    /** Reads requestTransformer from its owner. */
    requestTransformer:
        | ((details: SiteRequestDetails) => SiteRequestRedirect | undefined)
        | undefined;
    /** Reads requestHeadersTransformer from its owner. */
    requestHeadersTransformer:
        | ((details: SiteRequestDetails) => SiteRequestHeaders | undefined)
        | undefined;
    /** Reads shortcutHandler from its owner. */
    shortcutHandler: ((input: Input, editing: boolean) => boolean) | undefined;
    /** Requests destroySiteView from its owner. */
    readonly destroySiteView: () => void;
    /** Requests disposeVideoPlayback from its owner. */
    readonly disposeVideoPlayback: () => Promise<void>;
    /** Reads viewerWindow from its owner. */
    readonly viewerWindow: BrowserWindow | undefined;
    /** Reads siteView from its owner. */
    readonly siteView: WebContentsView | undefined;
    /** Reads videoView from its owner. */
    videoView: WebContentsView | undefined;
    /** Requests releaseVideoForUpdate from its owner. */
    readonly releaseVideoForUpdate: () => Promise<void>;
    /** Requests recoverVideoAfterFailedUpdate from its owner. */
    readonly recoverVideoAfterFailedUpdate: () => Promise<void>;
    /** Reads internalVideoPictureInPicture from its owner. */
    readonly internalVideoPictureInPicture:
        InternalVideoPictureInPictureState | undefined;
    /** Requests clearInternalVideoPictureInPictureReassertions from its owner. */
    readonly clearInternalVideoPictureInPictureReassertions: () => void;
    /** Requests clearInternalVideoPictureInPicturePointerMonitor from its owner. */
    readonly clearInternalVideoPictureInPicturePointerMonitor: () => void;
    /** Requests clearOverlayRevealTimer from its owner. */
    readonly clearOverlayRevealTimer: () => void;
    /** Reads editingWebContentsIds from its owner. */
    readonly editingWebContentsIds: Set<number>;
    /** Requests releaseNativeWindow from its owner. */
    readonly releaseNativeWindow: () => void;
    /** Reads overlaySurface from its owner. */
    overlaySurface: WebContentsView | undefined;
    /** Reads overlayVisible from its owner. */
    overlayVisible: boolean;
}

/** Coordinates viewer shutdown, update preparation, and recovery. */
export class ViewerLifecycle {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Cross-feature capabilities. */ private readonly host: ViewerLifecycleHost,
        /** Renderer logging service. */ private readonly logging: LoggingManager,
    ) {
        this.logger = logging.getLogger('windowManager');
    }

    /** The disposing value. */
    disposing = false;

    /** The viewer close prepared value. */
    viewerClosePrepared = false;

    /** The viewer close preparation value. */
    viewerClosePreparation?: Promise<void>;

    /** One terminal cleanup shared by repeated shutdown requests. */
    private disposal?: Promise<void>;

    /** Stops requests and attempts every feature cleanup even when one fails. */
    dispose(): Promise<void> {
        if (this.disposal) return this.disposal;
        this.disposing = true;
        this.disposal = completeCleanup([
            () => this.host.recordAppWindowPosition(),
            () => this.host.logViewer.dispose(),
            () => this.host.stopExternalFullscreenMonitoring(),
            () => this.host.stopVideoInitialization(),
            () => this.host.exitPictureInPictureForTransition(false),
            () => this.host.cancelExternalLogin(),
            () => this.host.closeSitePopups(),
            () => {
                this.host.newWindowPolicyResolver = undefined;
                this.host.siteActionHandler = undefined;
                this.host.navigationGuard = undefined;
                this.host.pictureInPictureGuard = undefined;
                this.host.pictureInPictureContentOverlaySelectors = undefined;
                this.host.pictureInPicture.setSubtitleControllerFactory(
                    undefined,
                );
                this.host.pictureInPictureStateHandler = undefined;
                this.host.requestTransformer = undefined;
                this.host.requestHeadersTransformer = undefined;
                this.host.shortcutHandler = undefined;
            },
            () => this.host.destroySiteView(),
            () => this.host.disposeVideoPlayback(),
            () => {
                const viewer = this.host.viewerWindow;
                if (viewer && !viewer.isDestroyed()) viewer.destroy();
            },
        ]);
        return this.disposal;
    }

    /** Flushes Chromium data and releases MPV without destroying interactive app managers. */
    async prepareForUpdateInstallation(): Promise<void> {
        this.preparingUpdate = true;
        await this.host.exitPictureInPictureForTransition(false);
        const sessions = new Set([session.defaultSession]);
        for (const window of BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) sessions.add(window.webContents.session);
        }
        if (
            this.host.siteView &&
            !this.host.siteView.webContents.isDestroyed()
        ) {
            sessions.add(this.host.siteView.webContents.session);
        }
        if (
            this.host.videoView &&
            !this.host.videoView.webContents.isDestroyed()
        ) {
            sessions.add(this.host.videoView.webContents.session);
        }
        await Promise.all(
            [...sessions].map(async (current) => {
                current.flushStorageData();
                await current.cookies.flushStore();
            }),
        );
        await this.host.releaseVideoForUpdate();
        // Native installer quit must not be cancelled by the ordinary asynchronous
        // title-bar close path. Reset this gate when installer startup fails.
        this.viewerClosePrepared = true;
    }

    /** Recreates detached Video resources and leaves the error overlay dismissible. */
    async recoverAfterFailedUpdate(): Promise<void> {
        this.viewerClosePrepared = false;
        this.preparingUpdate = false;
        await this.host.recoverVideoAfterFailedUpdate();
    }

    /** Prepares the viewer window close. */
    async prepareViewerWindowClose(viewer: BrowserWindow): Promise<void> {
        this.disposing = true;
        await this.host.recordAppWindowPosition();
        try {
            // The title-bar close button means application shutdown on every
            // platform. Close both PiP modes first so their native windows cannot
            // keep the macOS process alive after the viewer disappears.
            await this.host.exitPictureInPictureForTransition(false);
            // Detach libmpv before closing the Video WebContents.
            await this.host.releaseVideoForUpdate();
        } catch (error) {
            this.logger.error(
                'Failed to detach MPV before closing the Video view.',
                error,
            );
            await this.host
                .disposeVideoPlayback()
                .catch((disposeError: unknown) => {
                    this.logger.error(
                        'Failed to dispose MPV after detach failed.',
                        disposeError,
                    );
                });
        } finally {
            this.viewerClosePrepared = true;
            this.viewerClosePreparation = undefined;
            if (!viewer.isDestroyed()) viewer.close();
        }
    }
    /** Releases feature state after native viewer teardown. */
    handleViewerClosed(
        viewerWindow: BrowserWindow,
        overlaySurface: WebContentsView,
    ): void {
        const overlayWebContentsId = overlaySurface.webContents.id;
        const viewerWebContentsId = viewerWindow.webContents.id;

        this.host.logViewer.dispose();
        this.host.internalVideoPictureInPicture?.disposeDrag?.();
        this.host.clearInternalVideoPictureInPictureReassertions();
        this.host.clearInternalVideoPictureInPicturePointerMonitor();
        this.host.clearOverlayRevealTimer();
        this.host.stopExternalFullscreenMonitoring();
        this.host.stopVideoInitialization();
        this.host.pictureInPicture.handleViewerClosed();
        const siteWebContentsId = this.host.siteView?.webContents.id;
        if (siteWebContentsId)
            this.host.editingWebContentsIds.delete(siteWebContentsId);
        const videoWebContentsId = this.host.videoView?.webContents.id;
        if (videoWebContentsId)
            this.host.editingWebContentsIds.delete(videoWebContentsId);
        this.host.editingWebContentsIds.delete(overlayWebContentsId);
        this.host.editingWebContentsIds.delete(viewerWebContentsId);
        this.host.destroySiteView();
        if (
            this.host.videoView &&
            !this.host.videoView.webContents.isDestroyed()
        ) {
            // `closed` has already destroyed the native container; the retained
            // video renderer can still be alive during application shutdown.
            if (!viewerWindow.isDestroyed())
                detachWindowSurface(viewerWindow, this.host.videoView);
            this.host.videoView.webContents.close();
        }
        if (!overlaySurface.webContents.isDestroyed()) {
            overlaySurface.webContents.close();
        }
        this.host.releaseNativeWindow();
        this.host.videoView = undefined;
        this.host.overlaySurface = undefined;
        this.host.overlayVisible = false;
        this.viewerClosePrepared = false;
        this.viewerClosePreparation = undefined;
    }
    /** Reversible request gate while an installer is being prepared. */
    preparingUpdate = false;
    /** Rejects late external work without preventing internal cleanup/restore operations. */
    assertViewerRequestsAccepted(): void {
        if (!this.areViewerRequestsAccepted())
            throw new Error('The viewer is not accepting requests.');
    }

    /** Closes the application request gate before asynchronous feature teardown starts. */
    beginViewerShutdown(): void {
        this.disposing = true;
    }
    /** Reports whether user and Provider requests may start new work. */
    areViewerRequestsAccepted(): boolean {
        return !this.disposing && !this.preparingUpdate;
    }
}
