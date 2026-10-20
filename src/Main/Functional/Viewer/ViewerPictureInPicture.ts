import {
    BrowserWindow,
    screen,
    WebContentsView,
    type WebContents,
} from 'electron';
import {
    IPC_CHANNELS,
    type AppLocale,
    type VideoPresentationState,
} from '../../../Common/IPC';
import {
    DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
    DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
    DEFAULT_PICTURE_IN_PICTURE_SIZE,
    PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM,
    resolvePictureInPictureSize,
    type PictureInPictureLastPlacement,
    type PictureInPicturePlacementPreference,
    type PictureInPictureSizePreference,
} from '../../../Common/PictureInPicture';
import { getLocaleMessages } from '../Localization/Locale';
import { attachVideoPictureInPictureDrag } from '../Window/PictureInPicture/PictureInPictureAlignment';
import {
    trackPictureInPictureVisibility,
    type PictureInPictureVisibilityTracker,
} from '../Window/PictureInPicture/PictureInPictureVisibility';
import { transferWebContentsView } from '../Window/WebContentsViewTransfer';
import { bindVideoPictureInPictureEvents } from '../Window/WindowLifecycleEvents';
import {
    captureInternalVideoPictureInPicturePlacement,
    resolveInternalVideoPictureInPictureBounds,
} from '../Window/WindowOperations';
import type {
    InternalVideoPictureInPictureState,
    PictureInPictureManagerFactory,
} from '../Window/WindowRuntime';
import {
    configurePictureInPictureWindow,
    getPictureInPictureReassertionDelays,
    preparePictureInPicturePresentation,
    presentPictureInPicture,
    restorePictureInPicturePresentation,
} from '../../Platform/Presentation';
import type { LoggingManager } from '../../Manager/LoggingManager';
import { UnifiedPictureInPictureManager } from '../../Manager/UnifiedPictureInPictureManager';
/** Capabilities used by ViewerPictureInPicture; values are resolved from their owner at dispatch time. */
export interface ViewerPictureInPictureHost {
    /** Requests requireViewerWindow from its owner. */
    readonly requireViewerWindow: () => BrowserWindow;
    /** Requests requireSiteView from its owner. */
    readonly requireSiteView: () => WebContentsView;
    /** Reads overlaySurface from its owner. */
    readonly overlaySurface: WebContentsView | undefined;
    /** Reads viewerWindow from its owner. */
    readonly viewerWindow: BrowserWindow | undefined;
    /** Reads disposing from its owner. */
    readonly disposing: boolean;
    /** Requests focusViewer from its owner. */
    readonly focusViewer: () => void;
    /** Requests restoreOverlayAfterPictureInPicture from its owner. */
    readonly restoreOverlayAfterPictureInPicture: () => void;
    /** Reads appLocale from its owner. */
    readonly appLocale: AppLocale;
    /** Requests setPresentationSuppressed from its owner. */
    readonly setPresentationSuppressed: (value: boolean) => void;
    /** Requests assertViewerRequestsAccepted from its owner. */
    readonly assertViewerRequestsAccepted: () => void;
    /** Reads internalVideoVisible from its owner. */
    readonly internalVideoVisible: boolean;
    /** Requests requireSiteWebContents from its owner. */
    readonly requireSiteWebContents: () => WebContents;
    /** Requests prepareOverlayForPictureInPicture from its owner. */
    readonly prepareOverlayForPictureInPicture: () => boolean;
    /** Reads internalVideoPresentation from its owner. */
    readonly internalVideoPresentation: VideoPresentationState;
    /** Requests requireVideoView from its owner. */
    readonly requireVideoView: () => WebContentsView;
    /** Reads systemLocale from its owner. */
    readonly systemLocale: string;
    /** Requests syncVideoViewBounds from its owner. */
    readonly syncVideoViewBounds: () => void;
    /** Reads videoView from its owner. */
    readonly videoView: WebContentsView | undefined;
    /** Requests syncOverlayBounds from its owner. */
    readonly syncOverlayBounds: () => void;
}

/** Owns pip state and lifecycle independently of application composition. */
export class ViewerPictureInPicture {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Cross-feature capabilities. */ private readonly host: ViewerPictureInPictureHost,
        /** Renderer logging service. */ private readonly logging: LoggingManager,
        createPictureInPicture: PictureInPictureManagerFactory,
    ) {
        this.logger = logging.getLogger('windowManager');
        this.pictureInPicture = createPictureInPicture(
            () => this.host.requireViewerWindow(),
            () => this.host.requireSiteView(),
            () => this.pictureInPictureContentOverlaySelectors?.() ?? [],
            this.logging,
            (result) => {
                if (result.status === 'entered') {
                    this.suspendViewerAlwaysOnTopForPictureInPicture();
                } else if (result.status === 'exited') {
                    this.restoreViewerAlwaysOnTopAfterPictureInPicture();
                }
                const overlaySurface = this.host.overlaySurface;
                if (
                    overlaySurface &&
                    !overlaySurface.webContents.isDestroyed()
                ) {
                    overlaySurface.webContents.send(
                        IPC_CHANNELS.media.pictureInPictureChanged,
                        result,
                    );
                }
                this.pictureInPictureStateHandler?.(
                    result.status === 'entered',
                );
            },
            () => {
                const viewer = this.host.viewerWindow;
                if (!this.host.disposing && viewer && !viewer.isDestroyed()) {
                    this.host.focusViewer();
                    this.host.restoreOverlayAfterPictureInPicture();
                }
            },
            (placement) => this.pictureInPicturePlacementRecorder?.(placement),
            () => this.host.appLocale,
        );
    }

    // Provider PiP has one application-owned implementation. Site-specific
    // policy is supplied through the Provider API, never a parallel manager.
    /** The picture in picture value. */
    readonly pictureInPicture: UnifiedPictureInPictureManager;

    /** The internal video picture in picture value. */
    internalVideoPictureInPicture?: InternalVideoPictureInPictureState;

    /** The picture in picture placement value. */
    pictureInPicturePlacement = DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;

    /** The picture in picture portrait size value. */
    pictureInPicturePortraitSize = DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE;

    /** The picture in picture size value. */
    pictureInPictureSize = DEFAULT_PICTURE_IN_PICTURE_SIZE;

    /** Callback used to handle picture in picture guard. */
    pictureInPictureGuard?: (url: string) => boolean;

    /** Callback used to handle picture in picture content overlay selectors. */
    pictureInPictureContentOverlaySelectors?: () => readonly string[];

    /** Callback used to handle picture in picture state handler. */
    pictureInPictureStateHandler?: (active: boolean) => void;

    /** Callback used to handle picture in picture placement recorder. */
    pictureInPicturePlacementRecorder?: (
        placement: PictureInPictureLastPlacement,
    ) => Promise<void> | void;

    /** The restoring picture in picture value. */
    restoringPictureInPicture = false;

    /** The internal video picture in picture reassert timers value. */
    readonly internalVideoPictureInPictureReassertTimers = new Set<
        ReturnType<typeof setTimeout>
    >();

    /** Shared app-level native visibility policy for the internal Video PiP. */
    internalVideoPictureInPictureVisibility?: PictureInPictureVisibilityTracker;

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

    /** Determines whether the any picture in picture active condition applies. */
    isAnyPictureInPictureActive(): boolean {
        return Boolean(
            this.internalVideoPictureInPicture ||
            this.pictureInPicture.isActive(),
        );
    }

    /** Performs the suspend viewer always on top for picture in picture operation. */
    suspendViewerAlwaysOnTopForPictureInPicture(): void {
        this.host.setPresentationSuppressed(true);
    }

    /** Restores the viewer always on top after picture in picture. */
    restoreViewerAlwaysOnTopAfterPictureInPicture(): void {
        if (this.host.disposing || this.isAnyPictureInPictureActive()) return;
        this.host.setPresentationSuppressed(false);
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
        return this.runPictureInPictureTransition(async () => {
            this.host.assertViewerRequestsAccepted();
            if (this.host.internalVideoVisible) {
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
        });
    }

    /** Toggles the game picture in picture. */
    async toggleGamePictureInPicture() {
        return this.runPictureInPictureTransition(async () => {
            this.host.assertViewerRequestsAccepted();
            if (this.host.internalVideoVisible) {
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
        });
    }

    /** Determines whether the enter picture in picture condition applies. */
    canEnterPictureInPicture(): boolean {
        if (this.internalVideoPictureInPicture) return true;
        if (this.pictureInPicture.isActive()) return true;
        const webContents = this.host.requireSiteWebContents();
        return this.pictureInPictureGuard?.(webContents.getURL()) ?? true;
    }

    /** Toggles the picture in picture with overlay. */
    async togglePictureInPictureWithOverlay(
        toggle: (
            beforeEnter: () => boolean,
        ) => ReturnType<UnifiedPictureInPictureManager['toggle']>,
    ) {
        const entering = !this.pictureInPicture.isActive();
        let prepared = false;
        /** Performs the before enter operation. */
        const beforeEnter = (): boolean => {
            if (!entering) return true;
            if (!this.host.prepareOverlayForPictureInPicture()) return false;
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
                this.host.restoreOverlayAfterPictureInPicture();
            }
            throw error;
        }
        if (prepared && result.status !== 'entered') {
            this.restoreViewerAlwaysOnTopAfterPictureInPicture();
            this.host.restoreOverlayAfterPictureInPicture();
        }
        return result;
    }

    /** Restores the picture in picture. */
    async restorePictureInPicture(): Promise<void> {
        return this.runPictureInPictureTransition(async () => {
            if (this.restoringPictureInPicture) return;
            this.restoringPictureInPicture = true;
            try {
                const restoreInternalViewer =
                    this.internalVideoPictureInPicture !== undefined;
                await this.exitInternalVideoPictureInPicture();
                await this.pictureInPicture.exitAllModes();
                const viewer = this.host.viewerWindow;
                if (restoreInternalViewer && viewer && !viewer.isDestroyed()) {
                    this.host.focusViewer();
                    this.host.restoreOverlayAfterPictureInPicture();
                }
            } catch (error) {
                this.logger.error(
                    'PiP could not restore the viewer window.',
                    error,
                );
            } finally {
                this.restoringPictureInPicture = false;
            }
        });
    }

    /** Toggles the internal video picture in picture. */
    async toggleInternalVideoPictureInPicture() {
        if (this.internalVideoPictureInPicture) {
            await this.exitInternalVideoPictureInPicture();
            this.host.focusViewer();
            this.host.restoreOverlayAfterPictureInPicture();
            return {
                /** The status value. */
                status: 'exited' as const,
                /** The mode value. */
                mode: 'window' as const,
            };
        }
        if (!this.host.internalVideoPresentation.ready) {
            return {
                /** The status value. */
                status: 'no-video' as const,
                /** The mode value. */
                mode: 'window' as const,
            };
        }
        if (!this.host.prepareOverlayForPictureInPicture()) {
            return {
                /** The status value. */
                status: 'disabled' as const,
                /** The mode value. */
                mode: 'window' as const,
            };
        }

        const viewer = this.host.requireViewerWindow();
        const video = this.host.requireVideoView();
        const aspectRatio =
            this.host.internalVideoPresentation.width > 0 &&
            this.host.internalVideoPresentation.height > 0
                ? this.host.internalVideoPresentation.width /
                  this.host.internalVideoPresentation.height
                : undefined;
        const portrait = typeof aspectRatio === 'number' && aspectRatio < 1;
        const preferred = resolvePictureInPictureSize(
            portrait
                ? this.pictureInPicturePortraitSize
                : this.pictureInPictureSize,
            aspectRatio,
            portrait ? 'portrait' : 'landscape',
        );
        const bounds = resolveInternalVideoPictureInPictureBounds(
            viewer.getBounds(),
            preferred,
            this.pictureInPicturePlacement,
        );
        const pip = new BrowserWindow({
            ...bounds,
            show: false,
            frame: false,
            roundedCorners: false,
            backgroundColor: '#050506',
            title: getLocaleMessages(
                this.host.appLocale,
                this.host.systemLocale,
            ).nativeDialogs.videoWindowTitle,
            skipTaskbar: true,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
        });
        pip.setMenu(null);
        pip.setMenuBarVisibility(false);
        pip.setMinimumSize(
            Math.min(PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.width, bounds.width),
            Math.min(
                PICTURE_IN_PICTURE_AUTOMATIC_MINIMUM.height,
                bounds.height,
            ),
        );
        pip.setAspectRatio(aspectRatio ?? 0);
        bindVideoPictureInPictureEvents(pip, {
            layout: () => this.host.syncVideoViewBounds(),
            reassert: () =>
                this.scheduleInternalVideoPictureInPictureReassertion(),
            shouldRestore: () =>
                !this.host.disposing &&
                this.internalVideoPictureInPicture?.window === pip,
            restore: () => {
                void this.restorePictureInPicture();
            },
        });
        this.internalVideoPictureInPicture = { window: pip };
        this.suspendViewerAlwaysOnTopForPictureInPicture();
        preparePictureInPicturePresentation();
        configurePictureInPictureWindow(pip, false);
        try {
            video.webContents.send(
                IPC_CHANNELS.video.pictureInPictureChanged,
                true,
            );
            await transferWebContentsView({
                sourceWindow: viewer,
                targetWindow: pip,
                view: video,
            });
            viewer.hide();
            this.startInternalVideoPictureInPicturePointerMonitor(pip);
            this.internalVideoPictureInPicture.disposeDrag =
                attachVideoPictureInPictureDrag(
                    pip,
                    video.webContents,
                    () => this.pictureInPicturePlacement.align === true,
                );
            presentPictureInPicture(pip, video.webContents, true);
            this.scheduleInternalVideoPictureInPictureReassertion();
        } catch (error) {
            await this.exitInternalVideoPictureInPicture(false);
            throw error;
        }
        this.notifyPictureInPictureChanged({
            status: 'entered',
            mode: 'window',
        });
        return {
            /** The status value. */
            status: 'entered' as const,
            /** The mode value. */
            mode: 'window' as const,
        };
    }

    /** Performs the exit internal video picture in picture operation. */
    async exitInternalVideoPictureInPicture(notify = true): Promise<void> {
        const state = this.internalVideoPictureInPicture;
        if (!state) return;
        state.disposeDrag?.();
        this.clearInternalVideoPictureInPictureReassertions();
        this.clearInternalVideoPictureInPicturePointerMonitor();
        const viewer = this.host.viewerWindow;
        const video = this.host.videoView;
        const pip = state.window;
        if (!pip.isDestroyed()) {
            const placement =
                captureInternalVideoPictureInPicturePlacement(pip);
            if (placement)
                await this.pictureInPicturePlacementRecorder?.(placement);
        }
        this.internalVideoPictureInPicture = undefined;
        if (video && !video.webContents.isDestroyed()) {
            video.webContents.send(
                IPC_CHANNELS.video.pictureInPictureChanged,
                false,
            );
        }
        await restorePictureInPicturePresentation(pip, false);
        if (
            viewer &&
            !viewer.isDestroyed() &&
            video &&
            !video.webContents.isDestroyed()
        ) {
            viewer.show();
            await transferWebContentsView({
                sourceWindow: pip.isDestroyed() ? undefined : pip,
                targetWindow: viewer,
                view: video,
            });
            this.host.syncVideoViewBounds();
            video.setVisible(this.host.internalVideoVisible);
            this.host.syncOverlayBounds();
        }
        if (!pip.isDestroyed()) pip.destroy();
        this.restoreViewerAlwaysOnTopAfterPictureInPicture();
        if (notify) {
            this.notifyPictureInPictureChanged({
                status: 'exited',
                mode: 'window',
            });
        }
    }

    /** Schedules the internal video picture in picture reassertion. */
    scheduleInternalVideoPictureInPictureReassertion(): void {
        if (!this.internalVideoPictureInPicture) {
            return;
        }
        this.clearInternalVideoPictureInPictureReassertions();
        for (const delay of getPictureInPictureReassertionDelays()) {
            const timer = setTimeout(() => {
                this.internalVideoPictureInPictureReassertTimers.delete(timer);
                const pip = this.internalVideoPictureInPicture?.window;
                if (!pip || pip.isDestroyed()) return;
                presentPictureInPicture(pip);
            }, delay);
            this.internalVideoPictureInPictureReassertTimers.add(timer);
        }
    }

    /** Clears the internal video picture in picture reassertions. */
    clearInternalVideoPictureInPictureReassertions(): void {
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
    startInternalVideoPictureInPicturePointerMonitor(
        video: BrowserWindow,
    ): void {
        this.clearInternalVideoPictureInPicturePointerMonitor();
        this.internalVideoPictureInPictureVisibility =
            trackPictureInPictureVisibility(
                video,
                () => screen.getCursorScreenPoint(),
                () => this.internalVideoPictureInPicture?.window === video,
                (visible) => {
                    const contents = this.host.videoView?.webContents;
                    if (contents && !contents.isDestroyed())
                        contents.send(
                            IPC_CHANNELS.video.pictureInPicturePointerChanged,
                            visible,
                        );
                },
            );
    }

    /** Stops native PiP cursor polling and clears the renderer hover state. */
    clearInternalVideoPictureInPicturePointerMonitor(): void {
        this.internalVideoPictureInPictureVisibility?.dispose();
        this.internalVideoPictureInPictureVisibility = undefined;
    }

    /** Notifies the picture in picture changed. */
    notifyPictureInPictureChanged(result: {
        /** The status value. */
        readonly status: 'entered' | 'exited';
        /** The mode value. */
        readonly mode: 'window';
    }): void {
        const overlay = this.host.overlaySurface;
        if (overlay && !overlay.webContents.isDestroyed()) {
            overlay.webContents.send(
                IPC_CHANNELS.media.pictureInPictureChanged,
                result,
            );
        }
        this.pictureInPictureStateHandler?.(result.status === 'entered');
    }
    /** Last native presentation transition; failures do not poison later requests. */
    private presentationTransition: Promise<void> = Promise.resolve();
    /** Number of queued/in-flight transfers which prohibit decoder replacement. */
    private pendingPresentationTransitions = 0;
    /** Whether a native transfer is queued or in progress. */
    get isPictureInPictureTransitionPending(): boolean {
        return this.pendingPresentationTransitions > 0;
    }
    /** Runs one presentation operation after the previous transfer has settled. */
    private runPictureInPictureTransition<T>(
        operation: () => Promise<T>,
    ): Promise<T> {
        this.pendingPresentationTransitions++;
        const result = this.presentationTransition.then(operation, operation);
        this.presentationTransition = result.then(
            () => undefined,
            () => undefined,
        );
        return result.finally(() => {
            this.pendingPresentationTransitions--;
        });
    }
    /** Returns both content kinds to their original host before navigation or teardown. */
    exitPictureInPictureForTransition(notify = true): Promise<void> {
        return this.runPictureInPictureTransition(async () => {
            await this.exitInternalVideoPictureInPicture(notify);
            await this.pictureInPicture.exitAllModes();
        });
    }
}
