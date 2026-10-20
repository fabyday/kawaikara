import type { SiteLogger } from '@kawaikara/site-api';
import { app, type BrowserWindow, type WebContentsView } from 'electron';
import { createMpvMain, type MpvMain } from 'electron-mpv-video';
import { existsSync } from 'node:fs';
import type { VideoPlaybackCapabilities } from '../../../Common/IPC';
import { hasNativeVideoBackend } from '../../Platform/Graphics';
import { resolveMpvAddonPath } from './MpvAddonPath';
import { createMpvViewHost } from './MpvViewHost';

/** Bound on native decoder initialization before falling back to software rendering. */
const VIDEO_RENDERER_INITIALIZATION_TIMEOUT_MS = 5_000;

/** Window operations required by the playback runtime, independent of ViewerRuntime. */
export interface VideoPlaybackHost {
    /** Returns the retained Video surface, if it still belongs to the viewer. */
    getView(): WebContentsView | undefined;
    /** Recovery must not replace a surface while it is hosted in PiP. */
    isPictureInPicture(): boolean;
    /** Replaces the failed surface using the runtime's new renderer preferences. */
    replaceView(video: WebContentsView): Promise<boolean>;
}

/** Owns native playback attachment and renderer recovery, not window presentation. */
export class VideoPlaybackRuntime {
    /** Native service is scoped to the application window lifecycle. */
    private readonly mpv: MpvMain = createMpvMain({
        /** Native addon bundled with this application. */
        addonPath: resolveMpvAddonPath(),
    });
    /** Native service adapters keyed by retained Video surfaces. */
    private readonly mpvVideoHosts = new WeakMap<
        WebContentsView,
        BrowserWindow
    >();
    /** Sticky fallback after the shared-texture renderer fails. */
    private videoSoftwareRenderer = false;
    /** Suppresses late renderer load callbacks after application shutdown. */
    private disposed = false;
    /** Coalesces simultaneous timeout and renderer recovery requests. */
    private videoRendererRecovery?: Promise<boolean>;
    /** Initialization watchdog for the current surface. */
    private videoRendererInitializationTimer?: ReturnType<typeof setTimeout>;
    /** Identifies the renderer protected by the watchdog. */
    private videoRendererInitializationWebContentsId?: number;
    /** Identifies the renderer which completed initialization. */
    private readyVideoRendererWebContentsId?: number;

    /** Connects playback to the host's current view and replacement operation. */
    constructor(
        /** Host state is read at the time of each operation. */
        private readonly host: VideoPlaybackHost,
        /** Reports native initialization and recovery failures. */
        private readonly logger: Pick<SiteLogger, 'warn' | 'error'>,
    ) {}

    /** Chromium preferences required by the selected playback renderer. */
    get rendererPreferences(): {
        /** WebGPU is disabled only after native renderer initialization fails. */
        disableBlinkFeatures?: string;
    } {
        return this.videoSoftwareRenderer
            ? {
                  /** Force the fallback renderer to use its WebGL path. */
                  disableBlinkFeatures: 'WebGPU',
              }
            : {};
    }

    /** Forgets only the destroyed renderer, leaving a replacement's watchdog intact. */
    forget(webContentsId: number): void {
        this.clearWatchdog(webContentsId);
        if (this.readyVideoRendererWebContentsId === webContentsId)
            this.readyVideoRendererWebContentsId = undefined;
    }

    /** Clears asynchronous initialization work before releasing the native service. */
    async dispose(): Promise<void> {
        this.disposed = true;
        this.clearWatchdog();
        await this.mpv.dispose();
    }

    /** Returns the video playback capabilities. */
    getCapabilities(): VideoPlaybackCapabilities {
        const nativePlatform = hasNativeVideoBackend();
        return {
            /** The platform value. */
            platform: process.platform,
            /** The arch value. */
            arch: process.arch,
            /** The native backend available value. */
            nativeBackendAvailable:
                nativePlatform && existsSync(resolveMpvAddonPath()),
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

    /** Performs the recover video playback renderer operation. */
    recover(webContentsId: number): Promise<boolean> {
        if (this.disposed) return Promise.resolve(false);
        if (this.videoRendererRecovery) return this.videoRendererRecovery;
        if (this.videoSoftwareRenderer) return Promise.resolve(false);
        const video = this.host.getView();
        if (
            this.host.isPictureInPicture() ||
            !video ||
            video.webContents.isDestroyed() ||
            video.webContents.id !== webContentsId
        ) {
            return Promise.resolve(false);
        }

        this.logger.warn(
            'The shared-texture Video renderer did not initialize; retrying with the libmpv WebGL renderer.',
        );
        this.clearWatchdog(webContentsId);
        this.videoSoftwareRenderer = true;
        const recovery = this.host.replaceView(video).finally(() => {
            if (this.videoRendererRecovery === recovery) {
                this.videoRendererRecovery = undefined;
            }
        });
        this.videoRendererRecovery = recovery;
        return recovery;
    }

    /** Records that a Video playback renderer completed initialization. */
    markReady(webContentsId: number): void {
        const video = this.host.getView();
        if (
            !video ||
            video.webContents.isDestroyed() ||
            video.webContents.id !== webContentsId
        ) {
            return;
        }
        this.readyVideoRendererWebContentsId = webContentsId;
        this.clearWatchdog(webContentsId);
    }

    /** Connects the Video view to the unmodified libmpv service. */
    attach(video: WebContentsView): void {
        this.readyVideoRendererWebContentsId = undefined;
        const host = createMpvViewHost(video);
        this.mpv.attachWindow(host);
        this.mpvVideoHosts.set(video, host);
    }

    /** Releases a Video renderer from the libmpv service. */
    async detach(video: WebContentsView): Promise<void> {
        const host = this.mpvVideoHosts.get(video);
        if (!host) return;
        try {
            await this.mpv.detachWindow(host);
        } finally {
            this.mpvVideoHosts.delete(video);
        }
    }

    /** Starts a Main-process watchdog for a potentially frozen WebGPU renderer. */
    watch(video: WebContentsView): void {
        const webContentsId = video.webContents.id;
        this.clearWatchdog();
        if (
            this.disposed ||
            this.videoSoftwareRenderer ||
            !this.getCapabilities().nativeBackendAvailable ||
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
                this.host.getView() !== video ||
                this.readyVideoRendererWebContentsId === webContentsId
            ) {
                return;
            }
            this.logger.warn(
                'The Video renderer stopped responding during shared-texture initialization; switching to the libmpv WebGL renderer.',
            );
            void this.recover(webContentsId).catch((error: unknown) => {
                this.logger.error(
                    'Failed to recover the Video playback renderer.',
                    error,
                );
            });
        }, VIDEO_RENDERER_INITIALIZATION_TIMEOUT_MS);
    }

    /** Clears the Main-process Video renderer initialization watchdog. */
    clearWatchdog(webContentsId?: number): void {
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
}
