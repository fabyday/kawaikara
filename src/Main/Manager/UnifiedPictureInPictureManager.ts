import { bindPictureInPictureWindowEvents } from '../Functional/Window/PictureInPicture/PictureInPictureEvents';
import { createPictureInPictureWindow } from '../Functional/Window/PictureInPicture/PictureInPictureWindow';
import {
    handlePictureInPicturePointerInput,
    createPictureInPictureInputListener,
} from '../Functional/Window/PictureInPicture/PictureInPictureInput';
import {
    parseVideoSizeMessage,
    readPageResultStatus,
    readVideoAspectRatio,
} from '../Functional/Window/PictureInPicture/PictureInPicturePageResults';
import {
    resolveAnchoredResizeBounds,
    interpolateBounds,
    rectanglesMatch,
} from '../Functional/Window/PictureInPicture/PictureInPictureGeometry';
import {
    PIP_VIDEO_DISCOVERY_RETRY_MS,
    PIP_VIDEO_DISCOVERY_ATTEMPTS,
    PIP_RESTORE_MESSAGE,
    PIP_PLAYBACK_MESSAGE,
    PIP_CONTROL_ACTION_DEBOUNCE_MS,
    PIP_PLAYBACK_BUTTON_SIZE,
    PIP_VIDEO_SIZE_MESSAGE,
    PIP_ASPECT_RATIO_CHANGE_THRESHOLD,
    PIP_RESIZE_ANIMATION_DURATION_MS,
    PIP_RESIZE_ANIMATION_FRAME_MS,
} from '../Functional/Window/PictureInPicture/PictureInPictureConstants';
import {
    presentPictureInPicture,
    restorePictureInPicturePresentation,
    getPictureInPictureReassertionDelays,
} from '../Platform/Presentation';
import {
    app,
    BrowserWindow,
    screen,
    type Rectangle,
    type WebContentsView,
    type WebFrameMain,
} from 'electron';
import { PictureInPictureAlignment } from '../Functional/Window/PictureInPicture/PictureInPictureAlignment';
import { getLocaleMessages } from '../Functional/Localization/Locale';
import type { AppLocale, PictureInPictureResult } from '../../Common/IPC';
import {
    DEFAULT_PICTURE_IN_PICTURE_PLACEMENT,
    DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE,
    DEFAULT_PICTURE_IN_PICTURE_SIZE,
    resolvePictureInPictureSize,
    type PictureInPictureLastPlacement,
    type PictureInPicturePlacementPreference,
    type PictureInPictureSizePreference,
} from '../../Common/PictureInPicture';
import type { LoggingManager } from './LoggingManager';
import {
    PictureInPictureSubtitleRuntime,
    type PictureInPictureSubtitleFactory,
} from '../Functional/Window/PictureInPicture/PictureInPictureSubtitleRuntime';
import { transferWebContentsView } from '../Functional/Window/WebContentsViewTransfer';
import { trackPictureInPictureVisibility } from '../Functional/Window/PictureInPicture/PictureInPictureVisibility';
import {
    capturePictureInPicturePlacement,
    delay,
    fitPictureInPictureSize,
    isInspectableFrameUrl,
    parsePictureInPictureEnterResult,
    parseVideoCandidate,
    resolvePictureInPictureBounds,
    resolvePictureInPictureDisplay,
    withPictureInPictureWindowMode,
    type PictureInPictureVideoCandidate as VideoCandidate,
    type UnifiedPictureInPictureState,
} from '../Functional/Window/PictureInPicture/PictureInPictureRuntime';
import { createFindPictureInPictureVideoScript } from '../Inject/PictureInPictureVideo';
import {
    createEnterUnifiedPictureInPictureHostScript,
    createEnterUnifiedPictureInPictureScript,
    createRefreshUnifiedPictureInPictureVideoScript,
} from '../Inject/UnifiedPictureInPicturePage';
import {
    createFinishPictureInPictureTransitionScript,
    createExitUnifiedPictureInPictureScript,
    createExitUnifiedPictureInPictureHostScript,
    createPauseDocumentVideosScript,
    createSetPictureInPictureControlsVisibleScript,
    createTogglePictureInPicturePlaybackScript,
} from '../Inject/PictureInPictureControls';

/** Coordinates unified picture in picture behavior. */
export class UnifiedPictureInPictureManager {
    /** The enter promise value. */
    private enterPromise?: Promise<PictureInPictureResult>;
    /** The exit promise value. */
    private exitPromise?: Promise<PictureInPictureResult>;
    /** Finish in-flight frame rebinding before restoring the viewer on exit. */
    private videoRefresh?: Promise<void>;
    /** The state value. */
    private state?: UnifiedPictureInPictureState;
    /** The placement preference value. */
    private placementPreference = DEFAULT_PICTURE_IN_PICTURE_PLACEMENT;
    /** The placement write value. */
    private placementWrite = Promise.resolve();
    /** The portrait size preference value. */
    private portraitSizePreference = DEFAULT_PICTURE_IN_PICTURE_PORTRAIT_SIZE;
    /** The size preference value. */
    private sizePreference = DEFAULT_PICTURE_IN_PICTURE_SIZE;
    /** The registered picture-in-picture manager logger value. */
    private readonly logger;
    /** Frame-scoped subtitle lifecycle, isolated from native window errors. */
    private readonly subtitles;

    /** Creates an instance of UnifiedPictureInPictureManager. */
    constructor(
        /** Callback used to handle get viewer window. */
        private readonly getViewerWindow: () => BrowserWindow,
        /** Callback used to handle get site view. */
        private readonly getSiteView: () => WebContentsView,
        /** Callback used to handle get content overlay selectors. */
        private readonly getContentOverlaySelectors: () => readonly string[],
        /** The logging value. */
        private readonly logging: LoggingManager,
        /** Callback used to handle on state changed. */
        private readonly onStateChanged: (
            result: PictureInPictureResult,
        ) => void,
        /** Callback used to handle on exited. */
        private readonly onExited: () => void,
        /** Callback used to handle on last placement changed. */
        private readonly onLastPlacementChanged?: (
            placement: PictureInPictureLastPlacement,
        ) => Promise<void> | void,
        /** Reads app language when creating native and page-world PiP controls. */
        private readonly getLocale: () => AppLocale = () => 'system',
    ) {
        this.logger = logging.getLogger('pictureInPicture');
        this.subtitles = new PictureInPictureSubtitleRuntime(
            getContentOverlaySelectors,
            (error) => this.logger.debug('PiP subtitle adapter failed.', error),
        );
    }

    /** Connect the Provider method without expanding decorator metadata. */
    setSubtitleControllerFactory(
        factory: PictureInPictureSubtitleFactory | undefined,
    ): void {
        this.subtitles.setFactory(factory);
    }

    /** Apply common subtitle settings to the current player and future PiP entries. */
    setSubtitleScale(scale: number): Promise<void> {
        return this.subtitles.setScale(scale);
    }

    /** Sets the window size. */
    setWindowSize(preference: PictureInPictureSizePreference): void {
        this.sizePreference = preference;
    }

    /** Sets the portrait window size. */
    setPortraitWindowSize(preference: PictureInPictureSizePreference): void {
        this.portraitSizePreference = preference;
    }

    /** Sets the window placement. */
    setWindowPlacement(preference: PictureInPicturePlacementPreference): void {
        this.placementPreference = preference;
        if (!preference.align) this.state?.alignment?.cancel();
    }

    /** Determines whether the active condition applies. */
    isActive(): boolean {
        return this.state !== undefined;
    }

    /** Toggles the operation. */
    toggle(beforeEnter?: () => boolean): Promise<PictureInPictureResult> {
        if (this.exitPromise) return this.exitPromise;
        if (this.state) return this.exit();
        if (this.enterPromise) return this.enterPromise;

        const operation = this.enter(beforeEnter);
        this.enterPromise = operation;
        /** Clears the operation. */
        const clear = () => {
            if (this.enterPromise === operation) this.enterPromise = undefined;
        };
        void operation.then(clear, clear);
        return operation;
    }

    /** Performs the exit all modes operation. */
    async exitAllModes(): Promise<void> {
        if (this.enterPromise) await this.enterPromise;
        if (this.state) await this.exit();
        await this.placementWrite;
    }

    /** Handles the viewer closed. */
    handleViewerClosed(): void {
        const state = this.state;
        this.state = undefined;
        if (!state) return;
        state.closing = true;
        void this.subtitles.dispose();
        this.stopHoverTracking(state);
        this.clearFullscreenReassertions(state);
        this.clearVideoRefreshes(state);
        this.clearResizeAnimation(state);
        state.disposeWindowEvents?.();
        state.siteView.webContents.off(
            'console-message',
            state.consoleListener,
        );
        state.siteView.webContents.off(
            'before-input-event',
            state.inputListener,
        );
        state.siteView.webContents.off(
            'input-event',
            state.pointerInputListener,
        );
        state.siteView.webContents.off(
            'media-started-playing',
            state.mediaStartedListener,
        );
        state.siteView.webContents.off(
            'did-navigate',
            state.navigationListener,
        );
        state.siteView.webContents.off(
            'did-navigate-in-page',
            state.navigationListener,
        );
        void this.restoreHostFrames(state.hostFrames);
        void this.restoreApplicationPresentationAfterPictureInPicture(
            state.pipWindow,
        );
        if (!state.pipWindow.isDestroyed()) state.pipWindow.destroy();
    }

    /** Performs the enter operation. */
    private async enter(
        beforeEnter?: () => boolean,
    ): Promise<PictureInPictureResult> {
        const viewerWindow = this.getViewerWindow();
        const siteView = this.getSiteView();
        const candidate = await this.findVideoCandidate(siteView);
        if (!candidate) return withPictureInPictureWindowMode('no-video');
        if (candidate.status === 'not-ready') {
            return withPictureInPictureWindowMode('not-ready');
        }
        // Candidate discovery must happen before the host hides its menu or changes
        // macOS activation policy. Otherwise a harmless PiP request on a page with
        // no playable video visibly closes and reopens the application UI.
        if (beforeEnter && !beforeEnter()) {
            return withPictureInPictureWindowMode('disabled');
        }

        let pipWindow: BrowserWindow | undefined;
        let hostFrames: readonly WebFrameMain[] = [];
        try {
            hostFrames = await this.enterHostFrames(candidate.frame);
            const result = parsePictureInPictureEnterResult(
                await candidate.frame.executeJavaScript(
                    this.createEnterPageScript(),
                    true,
                ),
            );
            if (result.status !== 'entered') {
                await this.restoreHostFrames(hostFrames);
                return withPictureInPictureWindowMode(result.status);
            }

            const initialAspectRatio =
                result.aspectRatio ?? candidate.aspectRatio;
            const bounds = this.resolveInitialBounds(
                viewerWindow,
                initialAspectRatio,
            );
            pipWindow = this.createPipWindow(bounds, initialAspectRatio);

            const inputListener = createPictureInPictureInputListener(() => {
                void this.exit();
            });
            /** Performs the console listener operation. */
            const consoleListener = (
                details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
            ): void => {
                const activeState = this.state;
                if (!activeState || activeState.pipWindow !== pipWindow) return;
                if (details.message === PIP_RESTORE_MESSAGE) {
                    this.activateControl(activeState, 'restore');
                } else if (details.message === PIP_PLAYBACK_MESSAGE) {
                    this.activateControl(activeState, 'playback');
                } else {
                    const aspectRatio = parseVideoSizeMessage(details.message);
                    if (aspectRatio !== undefined) {
                        this.updateAspectRatio(activeState, aspectRatio);
                    }
                }
            };
            /** Performs the pointer input listener operation. */
            const pointerInputListener = (
                _event: Electron.Event,
                input: Electron.InputEvent,
            ): void => {
                const activeState = this.state;
                if (!activeState || activeState.pipWindow !== pipWindow) return;
                this.handlePointerInput(activeState, input);
            };
            /** Performs the media started listener operation. */
            const mediaStartedListener = (): void => {
                const activeState = this.state;
                if (!activeState || activeState.pipWindow !== pipWindow) return;
                this.scheduleVideoRefresh(activeState);
            };
            /** Performs the navigation listener operation. */
            const navigationListener = (): void => {
                const activeState = this.state;
                if (!activeState || activeState.pipWindow !== pipWindow) return;
                this.scheduleVideoRefresh(activeState);
            };
            const state: UnifiedPictureInPictureState = {
                aspectRatio: initialAspectRatio,
                closing: false,
                consoleListener,
                controlsVisible: false,
                frame: candidate.frame,
                fullscreenReassertTimers: new Set(),
                hostFrames,
                inputListener,
                mediaStartedListener,
                navigationListener,
                pipWindow,
                pointerInputListener,
                siteView,
                videoRefreshTimers: new Set(),
                refreshingVideo: false,
                viewerWindow,
            };
            this.state = state;
            state.alignment = new PictureInPictureAlignment(
                pipWindow,
                () =>
                    this.state === state &&
                    !state.closing &&
                    this.placementPreference.align === true,
            );
            this.attachWindowEvents(state);
            siteView.webContents.on('console-message', consoleListener);
            siteView.webContents.on('before-input-event', inputListener);
            siteView.webContents.on('input-event', pointerInputListener);
            siteView.webContents.on(
                'media-started-playing',
                mediaStartedListener,
            );
            siteView.webContents.on('did-navigate', navigationListener);
            siteView.webContents.on('did-navigate-in-page', navigationListener);

            await transferWebContentsView({
                sourceWindow: viewerWindow,
                targetWindow: pipWindow,
                view: siteView,
            });
            // The native PiP presentation can settle to a content size that differs
            // by a few pixels from the constructor bounds on macOS. Fill that final
            // content rect immediately instead of waiting for a user resize event.
            this.syncSiteViewBounds(state);
            viewerWindow.hide();
            presentPictureInPicture(pipWindow, siteView.webContents);
            await this.finishPageTransition(state.frame);
            this.startHoverTracking(state);
            this.scheduleFullscreenReassertion(state);

            // Fit and paint the video at the final native viewport before any
            // Provider subtitle factory can scan/reflow the page or await a player
            // API. Captions must measure PiP geometry, not the old viewer geometry.
            await this.subtitles.bind(
                state.frame,
                () => this.state === state && !state.closing,
            );

            const entered = withPictureInPictureWindowMode('entered');
            this.onStateChanged(entered);
            return entered;
        } catch (error) {
            this.logger.error('Unified PiP could not be started.', error);
            const state = this.state;
            this.state = undefined;
            if (state) {
                state.disposeWindowEvents?.();
                state.closing = true;
                this.stopHoverTracking(state);
                this.clearFullscreenReassertions(state);
                this.clearVideoRefreshes(state);
                this.clearResizeAnimation(state);
                state.siteView.webContents.off(
                    'console-message',
                    state.consoleListener,
                );
                state.siteView.webContents.off(
                    'before-input-event',
                    state.inputListener,
                );
                state.siteView.webContents.off(
                    'input-event',
                    state.pointerInputListener,
                );
                state.siteView.webContents.off(
                    'media-started-playing',
                    state.mediaStartedListener,
                );
                state.siteView.webContents.off(
                    'did-navigate',
                    state.navigationListener,
                );
                state.siteView.webContents.off(
                    'did-navigate-in-page',
                    state.navigationListener,
                );
            }
            await this.subtitles.dispose();
            await this.restoreInjectedVideo(candidate.frame);
            await this.restoreHostFrames(hostFrames);
            await this.restoreSiteView(viewerWindow, siteView, pipWindow);
            await this.finishPageTransition(candidate.frame);
            await this.restoreApplicationPresentationAfterPictureInPicture(
                pipWindow,
            );
            if (pipWindow && !pipWindow.isDestroyed()) pipWindow.destroy();
            viewerWindow.show();
            return withPictureInPictureWindowMode('failed');
        }
    }

    /** Performs the exit operation. */
    private exit(): Promise<PictureInPictureResult> {
        if (this.exitPromise) return this.exitPromise;
        const operation = this.performExit();
        this.exitPromise = operation;
        /** Clears the operation. */
        const clear = () => {
            if (this.exitPromise === operation) this.exitPromise = undefined;
        };
        void operation.then(clear, clear);
        return operation;
    }

    /** Performs the perform exit operation. */
    private async performExit(): Promise<PictureInPictureResult> {
        const state = this.state;
        if (!state) return withPictureInPictureWindowMode('exited');
        state.closing = true;
        this.stopHoverTracking(state);
        this.clearFullscreenReassertions(state);
        this.clearVideoRefreshes(state);
        this.clearResizeAnimation(state);
        state.disposeWindowEvents?.();
        state.siteView.webContents.off(
            'console-message',
            state.consoleListener,
        );
        state.siteView.webContents.off(
            'before-input-event',
            state.inputListener,
        );
        state.siteView.webContents.off(
            'input-event',
            state.pointerInputListener,
        );
        state.siteView.webContents.off(
            'media-started-playing',
            state.mediaStartedListener,
        );
        state.siteView.webContents.off(
            'did-navigate',
            state.navigationListener,
        );
        state.siteView.webContents.off(
            'did-navigate-in-page',
            state.navigationListener,
        );

        await this.videoRefresh;
        await this.subtitles.dispose();
        await this.rememberCurrentPlacement(state.pipWindow);
        await this.restoreInjectedVideo(state.frame);
        await this.restoreHostFrames(state.hostFrames);
        await this.restoreSiteView(
            state.viewerWindow,
            state.siteView,
            state.pipWindow,
        );
        await this.finishPageTransition(state.frame);
        this.state = undefined;
        if (!state.pipWindow.isDestroyed()) state.pipWindow.hide();
        await this.restoreApplicationPresentationAfterPictureInPicture(
            state.pipWindow,
        );
        if (!state.viewerWindow.isDestroyed()) state.viewerWindow.show();
        if (!state.pipWindow.isDestroyed()) state.pipWindow.destroy();

        const exited = withPictureInPictureWindowMode('exited');
        this.onStateChanged(exited);
        this.onExited();
        return exited;
    }

    /** Creates the native host using the current locale and diagnostics. */
    private createPipWindow(
        bounds: Rectangle,
        aspectRatio?: number,
    ): BrowserWindow {
        return createPictureInPictureWindow(
            bounds,
            aspectRatio,
            this.getLocale(),
            this.logging,
        );
    }

    /** Binds native events to the current session's semantic operations. */
    private attachWindowEvents(state: UnifiedPictureInPictureState): void {
        state.disposeWindowEvents = bindPictureInPictureWindowEvents(state, {
            /** Retired and closing sessions cannot trigger transitions. */
            isCurrent: () => !state.closing && this.state === state,
            /** User resize takes ownership from automatic animation. */
            resizeStarted: () => this.clearResizeAnimation(state),
            /** Keeps the retained surface fitted to the native host. */
            resized: () => this.syncSiteViewBounds(state),
            /** Restores platform-specific presentation after focus loss. */
            blurred: () => this.scheduleFullscreenReassertion(state),
            /** Logs an untrusted page close without ending the session. */
            closeBlocked: () =>
                this.logging
                    .getLogger('pictureInPicture', 'attachWindowEvents')
                    .debug(
                        'Ignored a page-originated close request for unified PiP.',
                    ),
            /** Unexpected native destruction restores the application. */
            closed: () => {
                void this.exit();
            },
        });
    }

    /** Performs the sync site view bounds operation. */
    private syncSiteViewBounds(state: UnifiedPictureInPictureState): void {
        if (state.pipWindow.isDestroyed()) return;
        const [width, height] = state.pipWindow.getContentSize();
        state.siteView.setBounds({
            x: 0,
            y: 0,
            width,
            height,
        });
    }

    /** Connects pointer gestures to the current PiP lifecycle. */
    private handlePointerInput(
        state: UnifiedPictureInPictureState,
        input: Electron.InputEvent,
    ): void {
        handlePictureInPicturePointerInput(state, input, {
            /** Keeps duplicate-control suppression in the manager. */
            activate: (action) => this.activateControl(state, action),
            /** Interrupts the current resize transaction. */
            interruptResize: () => this.clearResizeAnimation(state),
            /** Restores the deferred video shape. */
            updateAspectRatio: (ratio) => this.updateAspectRatio(state, ratio),
        });
    }

    /** Performs the activate control operation. */
    private activateControl(
        state: UnifiedPictureInPictureState,
        action: 'playback' | 'restore',
    ): void {
        if (this.state !== state || state.closing) return;
        const now = Date.now();
        if (
            state.lastControlAction?.action === action &&
            now - state.lastControlAction.at < PIP_CONTROL_ACTION_DEBOUNCE_MS
        ) {
            return;
        }
        state.lastControlAction = { action, at: now };
        if (action === 'restore') {
            void this.exit();
            return;
        }
        if (state.frame.isDestroyed()) return;
        void state.frame
            .executeJavaScript(
                createTogglePictureInPicturePlaybackScript(),
                true,
            )
            .then((result: unknown) => {
                if (
                    typeof result === 'object' &&
                    result !== null &&
                    'status' in result &&
                    result.status === 'failed'
                ) {
                    this.logging
                        .getLogger('pictureInPicture', 'activateControl')
                        .debug(
                            'Unified PiP playback control was rejected.',
                            result,
                        );
                }
            })
            .catch((error: unknown) => {
                this.logging
                    .getLogger('pictureInPicture', 'activateControl')
                    .debug('Unified PiP playback control failed.', error);
            });
    }

    /** Starts the hover tracking. */
    private startHoverTracking(state: UnifiedPictureInPictureState): void {
        this.stopHoverTracking(state);
        state.controlsVisibility = trackPictureInPictureVisibility(
            state.pipWindow,
            () => screen.getCursorScreenPoint(),
            () => this.state === state && !state.closing,
            (visible) => this.setControlsVisible(state, visible),
        );
    }

    /** Stops the hover tracking. */
    private stopHoverTracking(state: UnifiedPictureInPictureState): void {
        state.controlsVisibility?.dispose();
        state.controlsVisibility = undefined;
    }

    /** Schedules the fullscreen reassertion. */
    private scheduleFullscreenReassertion(
        state: UnifiedPictureInPictureState,
    ): void {
        this.clearFullscreenReassertions(state);
        for (const delayMilliseconds of getPictureInPictureReassertionDelays()) {
            const timer = setTimeout(() => {
                state.fullscreenReassertTimers.delete(timer);
                if (
                    this.state !== state ||
                    state.closing ||
                    state.pipWindow.isDestroyed()
                ) {
                    return;
                }
                // Reapply the full Chatty sequence after macOS moves focus/Spaces.
                presentPictureInPicture(state.pipWindow);
            }, delayMilliseconds);
            state.fullscreenReassertTimers.add(timer);
        }
    }

    /** Clears the fullscreen reassertions. */
    private clearFullscreenReassertions(
        state: UnifiedPictureInPictureState,
    ): void {
        for (const timer of state.fullscreenReassertTimers) clearTimeout(timer);
        state.fullscreenReassertTimers.clear();
    }

    /** Schedules the video refresh. */
    private scheduleVideoRefresh(state: UnifiedPictureInPictureState): void {
        // Short-form players begin playback before their vertical carousel has
        // settled. Refreshing immediately freezes that intermediate offset into
        // the PiP layout, so wait until the native transition is complete.
        this.clearVideoRefreshes(state);
        for (const delayMilliseconds of [620, 980]) {
            const timer = setTimeout(() => {
                state.videoRefreshTimers.delete(timer);
                if (this.state !== state || state.closing) {
                    return;
                }
                if (state.refreshingVideo) return;
                const operation = this.refreshActiveVideo(state);
                this.videoRefresh = operation;
                /** Avoid clearing a newer player's refresh operation. */
                const clear = () => {
                    if (this.videoRefresh === operation)
                        this.videoRefresh = undefined;
                };
                void operation.then(clear, clear);
            }, delayMilliseconds);
            state.videoRefreshTimers.add(timer);
        }
    }

    /** Performs the refresh active video operation. */
    private async refreshActiveVideo(
        state: UnifiedPictureInPictureState,
    ): Promise<void> {
        if (state.refreshingVideo || this.state !== state || state.closing)
            return;
        state.refreshingVideo = true;
        try {
            const candidate = await this.inspectVideoFrames(state.siteView);
            if (
                !candidate ||
                candidate.status !== 'ready' ||
                this.state !== state ||
                state.closing
            ) {
                return;
            }

            if (candidate.frame === state.frame && !state.frame.isDestroyed()) {
                let result: unknown = await state.frame.executeJavaScript(
                    createRefreshUnifiedPictureInPictureVideoScript(),
                    true,
                );
                if (readPageResultStatus(result) === 'missing') {
                    result = await state.frame.executeJavaScript(
                        this.createEnterPageScript(),
                        true,
                    );
                    this.setControlsVisible(state, state.controlsVisible, true);
                }
                const aspectRatio = readVideoAspectRatio(result);
                if (aspectRatio !== undefined) {
                    this.updateAspectRatio(state, aspectRatio);
                }
                if (
                    ['entered', 'refreshed'].includes(
                        readPageResultStatus(result) ?? '',
                    )
                ) {
                    // Keep the controller on ordinary refreshes. Replace it only when
                    // the selected video or its document actually changed.
                    await this.subtitles.bind(
                        state.frame,
                        () => this.state === state && !state.closing,
                    );
                }
                return;
            }

            // CHZZK Clips can replace its m.naver.com player iframe while moving
            // between clips. Rebuild both the host-frame path and the in-page PiP
            // controls in the newly active frame; keeping the original WebFrameMain
            // here leaves old audio alive and loses the restore overlay.
            const previousFrame = state.frame;
            const previousHostFrames = state.hostFrames;
            await this.restoreHostFrames(previousHostFrames);
            const nextHostFrames = await this.enterHostFrames(candidate.frame);
            const result = parsePictureInPictureEnterResult(
                await candidate.frame.executeJavaScript(
                    this.createEnterPageScript(),
                    true,
                ),
            );
            if (result.status !== 'entered') {
                await this.restoreHostFrames(nextHostFrames);
                if (!previousFrame.isDestroyed()) {
                    state.hostFrames =
                        await this.enterHostFrames(previousFrame);
                }
                return;
            }
            state.frame = candidate.frame;
            state.hostFrames = nextHostFrames;
            await this.subtitles.bind(
                state.frame,
                () => this.state === state && !state.closing,
            );
            if (result.aspectRatio !== undefined) {
                this.updateAspectRatio(state, result.aspectRatio);
            }
            // A replacement iframe owns a newly injected overlay. Reapply the
            // current native hover state even when the boolean did not change;
            // otherwise its buttons remain at their default hidden opacity.
            this.setControlsVisible(state, state.controlsVisible, true);
            if (!previousFrame.isDestroyed()) {
                await previousFrame
                    .executeJavaScript(createPauseDocumentVideosScript(), true)
                    .catch(() => undefined);
            }
            await this.restoreInjectedVideo(previousFrame);
        } catch (error) {
            if (this.state === state && !state.closing) {
                this.logger.debug(
                    'Unified PiP could not refresh its active video.',
                    error,
                );
            }
        } finally {
            state.refreshingVideo = false;
        }
    }

    /** Finishes page layout stabilization after native view transfer. */
    private async finishPageTransition(frame: WebFrameMain): Promise<void> {
        try {
            await frame.executeJavaScript(
                createFinishPictureInPictureTransitionScript(),
                true,
            );
        } catch {
            // Navigation may have destroyed the old document during transfer.
        }
    }

    /** Clears the video refreshes. */
    private clearVideoRefreshes(state: UnifiedPictureInPictureState): void {
        for (const timer of state.videoRefreshTimers) clearTimeout(timer);
        state.videoRefreshTimers.clear();
    }

    /** Applies a meaningful video aspect-ratio change to the active PiP. */
    private updateAspectRatio(
        state: UnifiedPictureInPictureState,
        aspectRatio: number,
    ): void {
        if (
            this.state !== state ||
            state.closing ||
            state.pipWindow.isDestroyed() ||
            !Number.isFinite(aspectRatio) ||
            aspectRatio < 0.1 ||
            aspectRatio > 10
        ) {
            return;
        }
        const comparedAspectRatio =
            state.resizeAnimation?.targetAspectRatio ??
            state.pendingAspectRatio ??
            state.aspectRatio;
        if (
            comparedAspectRatio !== undefined &&
            Math.abs(aspectRatio / comparedAspectRatio - 1) <
                PIP_ASPECT_RATIO_CHANGE_THRESHOLD
        ) {
            return;
        }
        if (state.dragState) {
            state.pendingAspectRatio = aspectRatio;
            return;
        }
        state.pendingAspectRatio = undefined;
        this.animateAspectRatio(state, aspectRatio);
    }

    /** Smoothly resizes the PiP while retaining its nearest screen edges. */
    private animateAspectRatio(
        state: UnifiedPictureInPictureState,
        aspectRatio: number,
    ): void {
        const pipWindow = state.pipWindow;
        const initialBounds = pipWindow.getBounds();
        const display = screen.getDisplayMatching(initialBounds);
        const portrait = aspectRatio < 1;
        const preferredSize = resolvePictureInPictureSize(
            portrait ? this.portraitSizePreference : this.sizePreference,
            aspectRatio,
            portrait ? 'portrait' : 'landscape',
        );
        const fittedSize = fitPictureInPictureSize(
            preferredSize,
            display.workArea,
        );
        const targetBounds = resolveAnchoredResizeBounds(
            initialBounds,
            display.workArea,
            fittedSize.width,
            fittedSize.height,
        );
        this.clearResizeAnimation(state);
        pipWindow.setAspectRatio(0);
        if (rectanglesMatch(initialBounds, targetBounds)) {
            state.aspectRatio = aspectRatio;
            pipWindow.setAspectRatio(aspectRatio);
            return;
        }

        const animation: NonNullable<
            UnifiedPictureInPictureState['resizeAnimation']
        > = {
            /** The aspect ratio reached at the end of the animation. */
            targetAspectRatio: aspectRatio,
        };
        state.resizeAnimation = animation;
        const startedAt = Date.now();
        /** Advances one resize animation frame. */
        const advance = () => {
            if (
                this.state !== state ||
                state.closing ||
                pipWindow.isDestroyed() ||
                state.resizeAnimation !== animation
            ) {
                return;
            }
            const progress = Math.min(
                1,
                (Date.now() - startedAt) / PIP_RESIZE_ANIMATION_DURATION_MS,
            );
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            pipWindow.setBounds(
                interpolateBounds(initialBounds, targetBounds, easedProgress),
                false,
            );
            if (progress >= 1) {
                state.resizeAnimation = undefined;
                state.aspectRatio = aspectRatio;
                pipWindow.setAspectRatio(aspectRatio);
                this.syncSiteViewBounds(state);
                if (state.alignAfterResize) {
                    state.alignAfterResize = false;
                    state.alignment?.snap();
                }
                return;
            }
            animation.timer = setTimeout(
                advance,
                PIP_RESIZE_ANIMATION_FRAME_MS,
            );
        };
        advance();
    }

    /** Stops the current smooth PiP resize without moving it again. */
    private clearResizeAnimation(state: UnifiedPictureInPictureState): void {
        state.alignment?.cancel();
        state.alignAfterResize = false;
        if (state.resizeAnimation?.timer !== undefined) {
            clearTimeout(state.resizeAnimation.timer);
        }
        state.resizeAnimation = undefined;
    }

    /** Restores application presentation after leaving PiP. */
    private async restoreApplicationPresentationAfterPictureInPicture(
        pipWindow?: BrowserWindow,
    ): Promise<void> {
        try {
            await restorePictureInPicturePresentation(pipWindow);
        } catch (error) {
            this.logger.warn(
                'Kawaikara could not restore its macOS Dock state.',
                error,
            );
        }
    }

    /** Sets the controls visible. */
    private setControlsVisible(
        state: UnifiedPictureInPictureState,
        visible: boolean,
        force = false,
    ): void {
        if (!force && state.controlsVisible === visible) return;
        state.controlsVisible = visible;
        // Preserve the native decision while an iframe is being replaced; the next
        // frame must not inherit the old frame's last visible state.
        if (state.frame.isDestroyed()) return;
        void state.frame
            .executeJavaScript(
                createSetPictureInPictureControlsVisibleScript(visible),
            )
            .catch((error: unknown) => {
                if (this.state === state && !state.closing) {
                    this.logger.debug(
                        'Unified PiP hover state could not be updated.',
                        error,
                    );
                }
            });
    }

    /** Restores the site view. */
    private restoreSiteView(
        viewerWindow: BrowserWindow,
        siteView: WebContentsView,
        sourceWindow?: BrowserWindow,
    ): Promise<void> {
        if (viewerWindow.isDestroyed() || siteView.webContents.isDestroyed()) {
            return Promise.resolve();
        }
        return transferWebContentsView({
            /** The source window value. */
            sourceWindow,
            /** The target window value. */
            targetWindow: viewerWindow,
            /** The view value. */
            view: siteView,
        });
    }

    /** Finds the video candidate. */
    private async findVideoCandidate(
        siteView: WebContentsView,
    ): Promise<VideoCandidate | undefined> {
        let candidate: VideoCandidate | undefined;
        for (
            let attempt = 0;
            attempt < PIP_VIDEO_DISCOVERY_ATTEMPTS;
            attempt += 1
        ) {
            candidate = await this.inspectVideoFrames(siteView);
            if (candidate?.status === 'ready') return candidate;
            if (attempt + 1 < PIP_VIDEO_DISCOVERY_ATTEMPTS) {
                await delay(PIP_VIDEO_DISCOVERY_RETRY_MS);
            }
        }
        return candidate;
    }

    /** Performs the inspect video frames operation. */
    private async inspectVideoFrames(
        siteView: WebContentsView,
    ): Promise<VideoCandidate | undefined> {
        let best: VideoCandidate | undefined;
        const frames = siteView.webContents.mainFrame.framesInSubtree.filter(
            (frame) => !frame.isDestroyed() && isInspectableFrameUrl(frame.url),
        );
        // Electron waits for a loading frame by temporarily subscribing to the
        // owning WebContents. Inspecting every iframe concurrently can therefore
        // exceed EventEmitter's listener limit on iframe-heavy streaming pages.
        // Sequential inspection bounds that temporary listener count to one.
        for (const frame of frames) {
            let candidate: VideoCandidate | undefined;
            try {
                const result = parseVideoCandidate(
                    await frame.executeJavaScript(
                        createFindPictureInPictureVideoScript(),
                    ),
                );
                candidate = result ? { frame, ...result } : undefined;
            } catch (error) {
                this.logger.debug(
                    `Unified PiP could not inspect frame ${frame.url}.`,
                    error,
                );
            }
            if (!candidate || (best && candidate.score <= best.score)) continue;
            best = candidate;
        }
        return best;
    }

    /** Resolves the initial bounds. */
    private resolveInitialBounds(
        viewerWindow: BrowserWindow,
        aspectRatio?: number,
    ): Rectangle {
        const display = resolvePictureInPictureDisplay(
            viewerWindow.getBounds(),
            this.placementPreference,
        );
        const portrait = typeof aspectRatio === 'number' && aspectRatio < 1;
        const preferredSize = resolvePictureInPictureSize(
            portrait ? this.portraitSizePreference : this.sizePreference,
            aspectRatio,
            portrait ? 'portrait' : 'landscape',
        );
        const size = fitPictureInPictureSize(
            {
                width: preferredSize.width,
                height: preferredSize.height,
            },
            display.workArea,
        );
        return resolvePictureInPictureBounds(
            display.workArea,
            size.width,
            size.height,
            this.placementPreference,
        );
    }

    /** Performs the remember current placement operation. */
    private async rememberCurrentPlacement(
        pipWindow: BrowserWindow,
    ): Promise<void> {
        if (pipWindow.isDestroyed() || !this.onLastPlacementChanged) return;
        const placement = capturePictureInPicturePlacement(pipWindow);
        this.placementWrite = this.placementWrite
            .then(() => this.onLastPlacementChanged?.(placement))
            .then(() => undefined)
            .catch((error: unknown) => {
                this.logger.warn(
                    'The last unified PiP position could not be saved.',
                    error,
                );
            });
        await this.placementWrite;
    }

    /** Restores the injected video. */
    private async restoreInjectedVideo(frame: WebFrameMain): Promise<void> {
        if (frame.isDestroyed()) return;
        await frame
            .executeJavaScript(createExitUnifiedPictureInPictureScript())
            .catch((error: unknown) => {
                this.logger.debug(
                    'Unified PiP video styles were already unavailable.',
                    error,
                );
            });
    }

    /** Selects runtime values; the injected DOM implementation stays in Inject/. */
    private createEnterPageScript(): string {
        return createEnterUnifiedPictureInPictureScript({
            /** The localized PiP button labels. */
            labels: getLocaleMessages(this.getLocale(), app.getLocale()).video,
            /** The content overlay selectors value. */
            contentOverlaySelectors: this.getContentOverlaySelectors(),
            /** The playback button size value. */
            playbackButtonSize: PIP_PLAYBACK_BUTTON_SIZE,
            /** The playback message value. */
            playbackMessage: PIP_PLAYBACK_MESSAGE,
            /** The restore message value. */
            restoreMessage: PIP_RESTORE_MESSAGE,
            /** The intrinsic video-size message prefix value. */
            videoSizeMessage: PIP_VIDEO_SIZE_MESSAGE,
        });
    }

    /** Performs the enter host frames operation. */
    private async enterHostFrames(
        videoFrame: WebFrameMain,
    ): Promise<readonly WebFrameMain[]> {
        const entered: WebFrameMain[] = [];
        let child = videoFrame;
        let parent = child.parent;
        try {
            while (parent) {
                if (parent.isDestroyed() || child.isDestroyed()) {
                    throw new Error(
                        'A PiP frame was destroyed during host preparation.',
                    );
                }
                const result = (await parent.executeJavaScript(
                    createEnterUnifiedPictureInPictureHostScript(child.url),
                    true,
                )) as { status?: unknown };
                if (result?.status !== 'entered') {
                    throw new Error(
                        `Could not expose embedded PiP frame (${String(result?.status)}).`,
                    );
                }
                entered.push(parent);
                child = parent;
                parent = child.parent;
            }
            return entered;
        } catch (error) {
            await this.restoreHostFrames(entered);
            throw error;
        }
    }

    /** Restores the host frames. */
    private async restoreHostFrames(
        frames: readonly WebFrameMain[],
    ): Promise<void> {
        await Promise.allSettled(
            [...frames]
                .reverse()
                .map((frame) =>
                    frame.isDestroyed()
                        ? Promise.resolve()
                        : frame.executeJavaScript(
                              createExitUnifiedPictureInPictureHostScript(),
                          ),
                ),
        );
    }
}
