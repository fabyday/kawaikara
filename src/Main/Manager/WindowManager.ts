import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import {
    APP_WINDOW_SIZE_LIMITS,
    DEFAULT_APP_WINDOW,
    fitAppWindowPreference,
    resolveAppWindowBounds,
    resolveAppWindowDisplay,
    validateAppWindow,
    type AppWindowLastPosition,
    type AppWindowPreference,
} from '../../Common/AppWindow';
import {
    leaveViewerFullScreen,
    observeDisplayConfiguration,
} from '../Functional/Window/WindowLifecycleEvents';
import { createExternalFullscreenMonitor } from '../Platform/ExternalFullscreenMonitor';
import { applyViewerAlwaysOnTop } from '../Platform/Presentation';
import type { LoggingManager } from './LoggingManager';
/** Allows foreground window state to settle after a native platform event. */
const EXTERNAL_FULLSCREEN_EVENT_SETTLE_MS = 40;

/** Owns native window geometry and presentation independently of application composition. */
export class WindowManager {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Renderer logging service. */ private readonly logging: LoggingManager,
    ) {
        this.logger = logging.getLogger('windowManager');
    }

    /** The viewer window value. */
    viewerWindow?: BrowserWindow;

    /** The app always on top value. */
    appAlwaysOnTop = false;

    /** The platform implementation of external fullscreen monitoring. */
    readonly externalFullscreenMonitor = createExternalFullscreenMonitor();

    /** Whether external fullscreen currently blocks the requested AOT state. */
    externalFullscreenBlocksAlwaysOnTop = false;

    /** Whether the external fullscreen monitor is running. */
    externalFullscreenMonitoring = false;

    /** Releases global display listeners when fullscreen monitoring stops. */
    stopObservingDisplays?: () => void;

    /** The pending event-driven external fullscreen refresh. */
    externalFullscreenRefreshTimer?: ReturnType<typeof setTimeout>;

    /** One bounded follow-up for fullscreen geometry that settles after activation. */
    externalFullscreenSettleTimer?: ReturnType<typeof setTimeout>;

    /** Startup policy is configured before the native window is created. */
    appWindowPreference: AppWindowPreference = DEFAULT_APP_WINDOW;

    /** Last normal position loaded from preferences. */
    appWindowLastPosition?: AppWindowLastPosition;

    /** Persists the normal app position before native teardown. */
    appWindowPositionRecorder?: (
        position: AppWindowLastPosition,
    ) => Promise<void>;

    /** Configures next-start placement without changing the live app window. */
    configureStartupWindow(
        preference: AppWindowPreference,
        lastPosition: AppWindowLastPosition | undefined,
        recorder: (position: AppWindowLastPosition) => Promise<void>,
    ): void {
        this.appWindowPreference = preference;
        this.appWindowLastPosition = lastPosition;
        this.appWindowPositionRecorder = recorder;
    }

    /** Uses saved placement for a new monitor policy and live placement for size-only edits. */
    appWindowPlacementForSave(
        preference: AppWindowPreference,
    ): AppWindowLastPosition | undefined {
        if (
            preference.monitor !== this.appWindowPreference.monitor ||
            preference.displayId !== this.appWindowPreference.displayId
        )
            return this.appWindowLastPosition;
        const viewer = this.viewerWindow;
        if (!viewer || viewer.isDestroyed()) return this.appWindowLastPosition;
        const bounds = viewer.getNormalBounds();
        return {
            /** Current normal-window display. */
            displayId: String(screen.getDisplayMatching(bounds).id),
            /** Current horizontal placement. */
            x: bounds.x,
            /** Current vertical placement. */
            y: bounds.y,
        };
    }

    /** Validates preferences against the current OS monitor work area at save time. */
    normalizeAppWindowPreference(
        preference: AppWindowPreference,
    ): AppWindowPreference {
        const value = validateAppWindow(preference);
        const target = resolveAppWindowDisplay(
            value,
            this.appWindowPlacementForSave(value),
            screen.getAllDisplays(),
            screen.getPrimaryDisplay(),
        );
        return fitAppWindowPreference(value, target);
    }

    /** Applies explicit size/monitor changes immediately; memory-only changes keep the live size. */
    async applyAppWindowPreference(
        preference: AppWindowPreference,
    ): Promise<void> {
        const previous = this.appWindowPreference;
        const position = this.appWindowPlacementForSave(preference);
        this.appWindowPreference = preference;
        if (
            previous.preset === preference.preset &&
            previous.monitor === preference.monitor &&
            previous.displayId === preference.displayId &&
            (preference.preset !== 'custom' ||
                (previous.width === preference.width &&
                    previous.height === preference.height))
        )
            return;
        const viewer = this.viewerWindow;
        if (!viewer || viewer.isDestroyed()) return;
        const bounds = resolveAppWindowBounds(
            { ...preference, rememberSize: false },
            position,
            screen.getAllDisplays(),
            screen.getPrimaryDisplay(),
        );
        await leaveViewerFullScreen(viewer);
        if (viewer.isDestroyed()) return;
        if (viewer.isMaximized()) viewer.unmaximize();
        viewer.setBounds(bounds);
    }

    /** Records normal bounds even when the viewer is maximized or fullscreen. */
    async recordAppWindowPosition(): Promise<void> {
        const viewer = this.viewerWindow;
        if (!viewer || viewer.isDestroyed() || !this.appWindowPositionRecorder)
            return;
        try {
            const normal = viewer.getNormalBounds();
            const display = screen.getDisplayMatching(viewer.getBounds());
            const area = display.workArea;
            const fillsWorkArea =
                viewer.isMaximized() ||
                viewer.isFullScreen() ||
                (Math.abs(normal.width - area.width) <= 2 &&
                    Math.abs(normal.height - area.height) <= 2);
            const bounds = fillsWorkArea ? area : normal;
            await this.appWindowPositionRecorder({
                displayId: String(display.id),
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                fillsWorkArea,
            });
        } catch (error) {
            this.logger.warn(
                'The app window position could not be saved.',
                error,
            );
        }
    }

    /** Sets the always on top. */
    setAlwaysOnTop(enabled: boolean): void {
        const requestedStateChanged = this.appAlwaysOnTop !== enabled;
        this.appAlwaysOnTop = enabled;
        if (enabled) this.startExternalFullscreenMonitoring();
        else this.stopExternalFullscreenMonitoring();
        const presentationSuppressed = this.presentationSuppressed;
        if (requestedStateChanged) {
            this.logger.info(
                `Always on top requested: ${String(enabled)}; ` +
                    `externalFullscreen=${String(this.externalFullscreenBlocksAlwaysOnTop)}; ` +
                    `presentationSuppressed=${String(presentationSuppressed)}.`,
            );
        }
        if (!presentationSuppressed) {
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

    /** Applies the always on top. */
    applyAlwaysOnTop(
        viewer: BrowserWindow,
        enabled: boolean,
        reassertPresentation = false,
    ): void {
        if (
            applyViewerAlwaysOnTop(
                viewer,
                enabled,
                this.externalFullscreenMonitor.isAlwaysOnTopApplied(viewer),
                reassertPresentation,
            )
        ) {
            this.logger.info(
                'Reasserting always on top after the platform removed the topmost flag.',
            );
        }
        if (!enabled) this.yieldToExternalFullscreen(viewer);
    }

    /** Restacks behind this display's fullscreen owner, respecting a retained explicit viewer activation. */
    yieldToExternalFullscreen(viewer: BrowserWindow): void {
        if (
            !this.appAlwaysOnTop ||
            !this.externalFullscreenBlocksAlwaysOnTop ||
            this.presentationSuppressed ||
            viewer.isDestroyed() ||
            !viewer.isVisible() ||
            viewer.isMinimized()
        )
            return;
        const anchor = this.externalFullscreenMonitor.getYieldTarget(viewer);
        if (!anchor) return;
        // HWND_NOTOPMOST (setAlwaysOnTop(false)) puts a window at the TOP of the
        // normal band, potentially still above the display's borderless game. Native
        // only supplies a live anchor below that game; Electron moves our own window
        // with SWP_NOACTIVATE. Never hide/minimize, focus the game, or fight z-order
        // continuously once the viewer and its owned windows are already below it.
        viewer.moveAbove(anchor);
        this.logger.info(
            'Yielded application window stacking to external fullscreen.',
            {
                /** Whether a visible application window still obstructs fullscreen after restacking. */
                stillObstructing: Boolean(
                    this.externalFullscreenMonitor.getYieldTarget(viewer),
                ),
            },
        );
    }

    /** Starts platform fullscreen monitoring while AOT is requested. */
    startExternalFullscreenMonitoring(): void {
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
            this.externalFullscreenMonitor.start(viewer, () =>
                this.scheduleExternalFullscreenRefresh(),
            );
        this.stopObservingDisplays = observeDisplayConfiguration(
            this.handleDisplayConfigurationChanged,
        );
    }

    /** Stops platform fullscreen monitoring when AOT is no longer requested. */
    stopExternalFullscreenMonitoring(): void {
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
            this.stopObservingDisplays?.();
            this.stopObservingDisplays = undefined;
            this.externalFullscreenMonitoring = false;
        }
        this.externalFullscreenBlocksAlwaysOnTop = false;
    }

    /** Coalesces native signals without waiting for an event burst to finish. */
    scheduleExternalFullscreenRefresh(): void {
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
    safelyRefreshExternalFullscreenState(deferRestoration = false): void {
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
    refreshExternalFullscreenState(
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
        this.handleExternalFullscreenChanged(fullscreen, reassertPresentation);
    }

    /** Handles a platform external fullscreen state change. */
    handleExternalFullscreenChanged(
        fullscreen: boolean,
        reassertPresentation = false,
    ): void {
        const suspended = this.appAlwaysOnTop && fullscreen;
        const stateChanged =
            suspended !== this.externalFullscreenBlocksAlwaysOnTop;
        const viewer = this.viewerWindow;
        if (!viewer || viewer.isDestroyed()) return;
        const nativeTopmost =
            this.externalFullscreenMonitor.isAlwaysOnTopApplied(viewer);
        const presentationWasLost = !suspended && nativeTopmost === false;
        const suppressionWasLost = suspended && nativeTopmost === true;
        if (
            !stateChanged &&
            !reassertPresentation &&
            !presentationWasLost &&
            !suppressionWasLost
        ) {
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
        if (!this.presentationSuppressed) {
            this.applyAlwaysOnTop(
                viewer,
                this.getEffectiveAppAlwaysOnTop(),
                reassertPresentation || presentationWasLost,
            );
        }
    }

    /** Handles display topology changes that can change the relevant monitor. */
    readonly handleDisplayConfigurationChanged = (): void => {
        this.refreshExternalFullscreenState();
    };

    /** Sets managed window opacity. */
    setManagedWindowOpacity(window: BrowserWindow, opacity: number): void {
        window.setOpacity(opacity);
    }

    /** Returns the effective application always on top state. */
    getEffectiveAppAlwaysOnTop(): boolean {
        return this.appAlwaysOnTop && !this.externalFullscreenBlocksAlwaysOnTop;
    }

    /** Toggles the app full screen. */
    toggleAppFullScreen(): void {
        const viewer = this.requireViewerWindow();
        viewer.setFullScreen(!viewer.isFullScreen());
    }

    /** Performs the exit app full screen operation. */
    exitAppFullScreen(): void {
        const viewer = this.requireViewerWindow();
        if (viewer.isFullScreen()) viewer.setFullScreen(false);
    }

    /** Performs the require viewer window operation. */
    requireViewerWindow(): BrowserWindow {
        if (!this.viewerWindow || this.viewerWindow.isDestroyed()) {
            throw new Error('The site viewer window has not been created.');
        }
        return this.viewerWindow;
    }

    /** Creates the native application host without deciding its content. */
    createNativeWindow(title: string, backgroundColor: string): BrowserWindow {
        if (this.viewerWindow && !this.viewerWindow.isDestroyed())
            return this.viewerWindow;
        const viewerWindow = new BrowserWindow({
            ...resolveAppWindowBounds(
                this.appWindowPreference,
                this.appWindowLastPosition,
                screen.getAllDisplays(),
                screen.getPrimaryDisplay(),
            ),
            minWidth: APP_WINDOW_SIZE_LIMITS.minWidth,
            minHeight: APP_WINDOW_SIZE_LIMITS.minHeight,
            title: title,
            backgroundColor: backgroundColor,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.resolve(__dirname, '../preload/viewer.js'),
                contextIsolation: true,
                nodeIntegration: false,
                webgl: true,
                backgroundThrottling: false,
                // The application host uses a trusted preload bridge.
                // Remote sites remain isolated in their sandboxed WebContentsView.
                sandbox: false,
            },
        });

        this.viewerWindow = viewerWindow;
        return viewerWindow;
    }

    /** Forgets the native host after its closed event. */
    releaseNativeWindow(): void {
        this.viewerWindow = undefined;
    }

    /** Whether an application presentation temporarily suppresses native topmost. */
    presentationSuppressed = false;

    /** Applies a presentation constraint without interpreting the requesting feature. */
    setPresentationSuppressed(value: boolean): void {
        this.presentationSuppressed = value;
        const viewer = this.viewerWindow;
        if (!viewer || viewer.isDestroyed()) return;
        this.refreshExternalFullscreenState();
        this.applyAlwaysOnTop(
            viewer,
            !value && this.getEffectiveAppAlwaysOnTop(),
        );
    }
}
