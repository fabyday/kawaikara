import {
    BrowserWindow,
    dialog,
    WebContentsView,
    type WebContents,
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    IPC_CHANNELS,
    type AppLocale,
    type VideoOpenRequest,
    type VideoPlaybackCapabilities,
    type VideoPresentationState,
} from '../../../Common/IPC';
import { getLocaleMessages } from '../Localization/Locale';
import { VideoPlaybackRuntime } from './VideoPlaybackRuntime';
import { DetachableWindowSurface } from '../Window/DetachableWindowSurface';
import { bindAppSurfaceEvents } from '../Window/ViewerWindowEvents';
import { type WindowInputSurface } from '../Window/WindowInput';
import { normalizeVideoDimension } from '../Window/WindowOperations';
import type { InternalVideoPictureInPictureState } from '../Window/WindowRuntime';
import {
    attachWindowSurface,
    detachWindowSurface,
} from '../Window/WindowSurfaceHost';
import { shouldPrewarmVideoSurface } from '../../Platform/Graphics';
import type { LoggingManager } from '../../Manager/LoggingManager';

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
/** Capabilities used by VideoController; values are resolved from their owner at dispatch time. */
export interface VideoControllerHost {
    /** Reads internalVideoPictureInPicture from its owner. */
    readonly internalVideoPictureInPicture:
        InternalVideoPictureInPictureState | undefined;
    /** Reads isPictureInPictureTransitionPending from its owner. */
    readonly isPictureInPictureTransitionPending: boolean;
    /** Reads appLocale from its owner. */
    readonly appLocale: AppLocale;
    /** Reads systemLocale from its owner. */
    readonly systemLocale: string;
    /** Requests requireViewerWindow from its owner. */
    readonly requireViewerWindow: () => BrowserWindow;
    /** Requests assertViewerRequestsAccepted from its owner. */
    readonly assertViewerRequestsAccepted: () => void;
    /** Reads internalVideoVisible from its owner. */
    internalVideoVisible: boolean;
    /** Reads disposing from its owner. */
    readonly disposing: boolean;
    /** Reads viewerWindow from its owner. */
    readonly viewerWindow: BrowserWindow | undefined;
    /** Reads overlayVisible from its owner. */
    readonly overlayVisible: boolean;
    /** Requests connectWindowInput from its owner. */
    readonly connectWindowInput: (
        contents: WebContents,
        surface: WindowInputSurface,
    ) => () => void;
    /** Reads editingWebContentsIds from its owner. */
    readonly editingWebContentsIds: Set<number>;
    /** Reads logViewer from its owner. */
    readonly logViewer: DetachableWindowSurface;
    /** Requests syncOverlayBounds from its owner. */
    readonly syncOverlayBounds: () => void;
    /** Requests requireSiteView from its owner. */
    readonly requireSiteView: () => WebContentsView;
    /** Reads siteViewAttached from its owner. */
    siteViewAttached: boolean;
    /** Requests focusUnderlyingLogViewer from its owner. */
    readonly focusUnderlyingLogViewer: () => void;
}

/** Owns video state and lifecycle independently of application composition. */
export class VideoController {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Cross-feature capabilities. */ private readonly host: VideoControllerHost,
        /** Renderer logging service. */ private readonly logging: LoggingManager,
    ) {
        this.logger = logging.getLogger('windowManager');
        this.videoPlayback = new VideoPlaybackRuntime(
            {
                getView: () => this.videoView,
                isPictureInPicture: () =>
                    Boolean(this.host.internalVideoPictureInPicture) ||
                    this.host.isPictureInPictureTransitionPending,
                replaceView: (video) => this.replaceVideoPlaybackView(video),
            },
            this.logger,
        );
    }

    /** Native playback owns decoding and recovery independently of window state. */
    readonly videoPlayback: VideoPlaybackRuntime;

    /** The retained internal Video renderer. */
    videoView?: WebContentsView;

    /** The in-flight Video renderer load. */
    videoViewLoading?: Promise<WebContentsView>;

    /** The internal video presentation value. */
    internalVideoPresentation: VideoPresentationState = {
        /** Whether the ready option is enabled. */
        ready: false,
        /** The width value. */
        width: 0,
        /** The height value. */
        height: 0,
    };

    /** The current video open request value. */
    currentVideoOpenRequest: VideoOpenRequest | null = null;

    /** The pending video open request value. */
    pendingVideoOpenRequest?: VideoOpenRequest;

    /** The last local video open request value. */
    lastLocalVideoOpenRequest?: Extract<
        VideoOpenRequest,
        {
            /** The kind value. */
            readonly kind: 'local';
        }
    >;

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
            if (
                !VIDEO_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
            ) {
                continue;
            }
            try {
                if (!(await fs.stat(filePath)).isFile()) {
                    continue;
                }
            } catch {
                continue;
            }
            const request: Extract<
                VideoOpenRequest,
                { readonly kind: 'local' }
            > = {
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
        const labels = getLocaleMessages(
            this.host.appLocale,
            this.host.systemLocale,
        ).nativeDialogs;
        const viewer = this.host.requireViewerWindow();
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
                { name: labels.allFiles, extensions: ['*'] },
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
        return this.videoPlayback.getCapabilities();
    }

    /** Performs the queue you tube downloader operation. */
    queueYouTubeDownloader(url: string): void {
        this.host.assertViewerRequestsAccepted();
        this.pendingVideoOpenRequest = { kind: 'youtube', url };
    }

    /** Returns the current video open request. */
    getCurrentVideoOpenRequest(): VideoOpenRequest | null {
        return this.currentVideoOpenRequest;
    }

    /** Performs the activate video open request operation. */
    activateVideoOpenRequest(
        webContentsId: number,
        request: Extract<
            VideoOpenRequest,
            {
                /** The kind value. */
                readonly kind: 'local';
            }
        >,
    ): boolean {
        const video = this.videoView;
        if (
            !this.host.internalVideoVisible ||
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
        return this.videoPlayback.recover(webContentsId);
    }

    /** Records that a Video playback renderer completed initialization. */
    notifyVideoPlaybackRendererReady(webContentsId: number): void {
        return this.videoPlayback.markReady(webContentsId);
    }

    /** Warms the persistent Windows Video surface before its first activation. */
    async prepareInternalVideoView(): Promise<void> {
        if (!shouldPrewarmVideoSurface() || this.host.disposing) return;
        const video = await this.ensureVideoView();
        if (
            this.host.disposing ||
            this.host.internalVideoVisible ||
            video.webContents.isDestroyed() ||
            this.videoView !== video
        ) {
            return;
        }
        // Keep the renderer inactive until the Video Provider is selected.
        this.setInternalVideoSiteVisibility(video, false);
    }

    /** Recreates the Video view with the software renderer. */
    async replaceVideoPlaybackView(video: WebContentsView): Promise<boolean> {
        this.internalVideoPresentation = { ready: false, width: 0, height: 0 };
        video.setVisible(false);
        await this.videoPlayback.detach(video);
        if (this.videoView === video) this.videoView = undefined;
        detachWindowSurface(this.host.viewerWindow, video);
        video.webContents.close();

        if (!this.host.internalVideoVisible || this.host.disposing)
            return false;
        const replacement = await this.ensureVideoView();
        this.syncVideoViewBounds();
        this.setInternalVideoSiteVisibility(replacement, true);
        replacement.webContents.focus();
        return true;
    }

    /** Performs the queue video open request operation. */
    queueVideoOpenRequest(request: VideoOpenRequest): void {
        this.host.assertViewerRequestsAccepted();
        this.pendingVideoOpenRequest = request;
        if (request.kind === 'local') this.lastLocalVideoOpenRequest = request;
    }

    /** Delivers a queued request to an already active Video view. */
    presentQueuedVideoOpenRequest(): boolean {
        const request = this.pendingVideoOpenRequest;
        const video = this.videoView;
        if (
            !request ||
            !this.host.internalVideoVisible ||
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

    /** Sets the internal video presentation. */
    setInternalVideoPresentation(
        webContentsId: number,
        value: unknown,
    ): boolean {
        const video = this.videoView;
        if (
            !this.host.internalVideoVisible ||
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

    /** Routes physical browser commands to folders, never to video.html history. */
    navigateVideoDirectory(direction: 'back' | 'forward'): void {
        const video = this.videoView;
        if (
            !this.host.internalVideoVisible ||
            this.host.internalVideoPictureInPicture ||
            this.host.overlayVisible ||
            !video ||
            video.webContents.isDestroyed()
        )
            return;
        video.webContents.send(
            IPC_CHANNELS.video.directoryNavigationRequested,
            direction,
        );
    }

    /** Sizes the retained Video renderer in its current native host. */
    syncVideoViewBounds(): void {
        const video = this.videoView;
        if (!video || video.webContents.isDestroyed()) return;
        const host =
            this.host.internalVideoPictureInPicture?.window ??
            this.host.viewerWindow;
        if (!host || host.isDestroyed()) return;
        const [width, height] = host.getContentSize();
        video.setBounds({ x: 0, y: 0, width, height });
    }

    /** Creates one persistent Video renderer without creating a native window. */
    ensureVideoView(): Promise<WebContentsView> {
        const existing = this.videoView;
        if (existing && !existing.webContents.isDestroyed())
            return Promise.resolve(existing);
        if (this.videoViewLoading) return this.videoViewLoading;

        const viewer = this.host.requireViewerWindow();
        const video = new WebContentsView({
            webPreferences: {
                preload: path.resolve(__dirname, '../preload/viewer.js'),
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false,
                ...this.videoPlayback.rendererPreferences,
                // electron-mpv-video exposes its renderer bridge from this preload.
                sandbox: false,
            },
        });
        video.setBackgroundColor('#050506');
        video.setVisible(false);
        attachWindowSurface(viewer, video);
        this.videoView = video;
        this.syncVideoViewBounds();
        this.logging.attachRenderer(video.webContents, 'rendererVideo');
        this.videoPlayback.attach(video);
        const webContentsId = video.webContents.id;
        this.host.connectWindowInput(video.webContents, 'video');
        bindAppSurfaceEvents(video.webContents, {
            loading: () =>
                this.host.editingWebContentsIds.delete(webContentsId),
            destroyed: () => {
                this.videoPlayback.forget(webContentsId);
                this.host.editingWebContentsIds.delete(webContentsId);
                if (this.videoView === video) {
                    this.videoView = undefined;
                    this.host.internalVideoVisible = false;
                    this.internalVideoPresentation = {
                        ready: false,
                        width: 0,
                        height: 0,
                    };
                }
            },
        });

        const loading = video.webContents
            .loadFile(path.resolve(__dirname, '../renderer/video.html'))
            .then(() => {
                if (
                    this.host.disposing ||
                    this.videoView !== video ||
                    video.webContents.isDestroyed()
                )
                    throw new Error('Video initialization was superseded.');
                this.videoPlayback.watch(video);
                return video;
            })
            .catch(async (error: unknown) => {
                if (!video.webContents.isDestroyed()) {
                    await this.videoPlayback
                        .detach(video)
                        .catch(() => undefined);
                    detachWindowSurface(viewer, video);
                    video.webContents.close();
                }
                if (this.videoView === video) this.videoView = undefined;
                throw error;
            })
            .finally(() => {
                if (this.videoViewLoading === loading)
                    this.videoViewLoading = undefined;
            });
        this.videoViewLoading = loading;
        return loading;
    }

    /** Returns the retained Video view. */
    requireVideoView(): WebContentsView {
        const video = this.videoView;
        if (!video || video.webContents.isDestroyed()) {
            throw new Error('The Video view has not been created.');
        }
        return video;
    }

    /** Gives keyboard focus back to the persistent internal Video child. */
    focusInternalVideoView(): void {
        const video = this.videoView;
        if (
            !this.host.internalVideoVisible ||
            this.host.overlayVisible ||
            this.host.logViewer.isEmbedded() ||
            !video ||
            video.webContents.isDestroyed() ||
            !video.getVisible()
        ) {
            return;
        }
        video.webContents.focus();
    }

    /** Shows the retained Video renderer within the Viewer window. */
    setInternalVideoSiteVisibility(
        video: WebContentsView,
        visible: boolean,
    ): void {
        video.webContents.send(IPC_CHANNELS.video.visibilityChanged, visible);
        video.setVisible(visible);
        if (visible) {
            attachWindowSurface(this.host.viewerWindow, video);
            this.syncVideoViewBounds();
            this.host.syncOverlayBounds();
        }
    }

    /** Presents the retained video renderer, consuming only an explicit pending request. */
    async presentInternalVideo(): Promise<void> {
        const viewer = this.host.requireViewerWindow();
        const siteView = this.host.requireSiteView();
        if (this.host.siteViewAttached) {
            detachWindowSurface(viewer, siteView);
            this.host.siteViewAttached = false;
        }
        this.host.internalVideoVisible = true;
        this.internalVideoPresentation = {
            ready: false,
            width: 0,
            height: 0,
        };
        // The Video renderer remains alive and paused while another Provider
        // is active. Only explicit open actions should reload its source. A
        // plain return to Video must preserve the existing mpv session and
        // playback position instead of reopening and auto-playing the file.
        const existingVideo = Boolean(
            this.videoView && !this.videoView.webContents.isDestroyed(),
        );
        const request =
            this.pendingVideoOpenRequest ??
            (!existingVideo ? this.lastLocalVideoOpenRequest : undefined);
        this.pendingVideoOpenRequest = undefined;
        if (request) this.currentVideoOpenRequest = request;
        else if (!existingVideo) this.currentVideoOpenRequest = null;
        const video = await this.ensureVideoView();
        if (this.host.disposing || !this.host.internalVideoVisible) return;
        this.syncVideoViewBounds();
        this.setInternalVideoSiteVisibility(video, true);
        if (this.host.overlayVisible) this.host.syncOverlayBounds();
        if (existingVideo && request) {
            video.webContents.send(
                IPC_CHANNELS.video.openRequestChanged,
                request,
            );
        }
        if (!this.host.logViewer.focusEmbedded())
            this.host.focusUnderlyingLogViewer();
    }
    /** Rebuilds playback resources after a failed installer launch. */
    async recoverVideoAfterFailedUpdate(): Promise<void> {
        if (this.host.disposing) return;
        const existing = this.videoView;
        if (existing && !existing.webContents.isDestroyed()) {
            // Detach can fail after removing its ownership listener. Recreate
            // that surface as well instead of leaving its renderer bound to dead MPV.
            await this.videoPlayback
                .detach(existing)
                .catch((reason: unknown) => {
                    this.logger.warn(
                        'Could not detach the failed update Video surface.',
                        reason,
                    );
                });
            this.videoView = undefined;
            detachWindowSurface(this.host.viewerWindow, existing);
            existing.webContents.close();
        }
        if (this.host.internalVideoVisible) {
            // The new renderer reads currentVideoOpenRequest through normal IPC;
            // do not enqueue an older local file over the user's current HLS source.
            const video = await this.ensureVideoView();
            this.syncVideoViewBounds();
            this.setInternalVideoSiteVisibility(video, true);
            if (this.host.overlayVisible) this.host.syncOverlayBounds();
        } else {
            await this.prepareInternalVideoView();
        }
    }
    /** Releases the renderer before native teardown, retaining the current open request for recovery. */
    async releaseVideoForUpdate(): Promise<void> {
        const video = this.videoView;
        if (video && !video.webContents.isDestroyed()) {
            await this.videoPlayback.detach(video);
            this.videoView = undefined;
            // Unlink first so the destroyed handler does not clear Provider visibility;
            // recovery needs to know which surface the user was interacting with.
            detachWindowSurface(this.host.viewerWindow, video);
            video.webContents.close();
            this.internalVideoPresentation = {
                ready: false,
                width: 0,
                height: 0,
            };
        }
    }
    /** Cancels renderer initialization without changing the selected content. */
    stopVideoInitialization(): void {
        this.videoPlayback.clearWatchdog();
    }
    /** Releases native playback even when detaching the retained renderer fails. */
    async disposeVideoPlayback(): Promise<void> {
        try {
            await this.releaseVideoForUpdate();
        } finally {
            await this.videoPlayback.dispose();
        }
    }
}
