import {
    BrowserWindow,
    WebContentsView,
    type Rectangle,
    type WebContents,
} from 'electron';
import path from 'node:path';
import {
    IPC_CHANNELS,
    type AppLocale,
    type AppTheme,
    type DevToolsMode,
} from '../../../Common/IPC';
import type { LogViewerHostState } from '../../../Common/LogViewer';
import { DetachableWindowSurface } from '../Window/DetachableWindowSurface';
import { type WindowInputSurface } from '../Window/WindowInput';
import { bindDevToolsBoundsEvents } from '../Window/WindowLifecycleEvents';
import type { LoggingManager } from '../../Manager/LoggingManager';
/** Capabilities used by ViewerDiagnostics; values are resolved from their owner at dispatch time. */
export interface ViewerDiagnosticsHost {
    /** Reads viewerWindow from its owner. */
    readonly viewerWindow: BrowserWindow | undefined;
    /** Requests focusUnderlyingLogViewer from its owner. */
    readonly focusUnderlyingLogViewer: () => void;
    /** Reads appTheme from its owner. */
    readonly appTheme: AppTheme;
    /** Reads appLocale from its owner. */
    readonly appLocale: AppLocale;
    /** Reads overlaySurface from its owner. */
    readonly overlaySurface: WebContentsView | undefined;
    /** Requests getActiveViewerWebContents from its owner. */
    readonly getActiveViewerWebContents: () => WebContents | undefined;
    /** Requests connectWindowInput from its owner. */
    readonly connectWindowInput: (
        contents: WebContents,
        surface: WindowInputSurface,
    ) => () => void;
}

/** Owns diagnostics state and lifecycle independently of application composition. */
export class ViewerDiagnostics {
    /** Feature logger. */
    private readonly logger;
    /** Connects only the capabilities used by this owner. */
    constructor(
        /** Cross-feature capabilities. */ private readonly host: ViewerDiagnosticsHost,
        /** Renderer logging service. */ private readonly logging: LoggingManager,
    ) {
        this.logger = logging.getLogger('windowManager');
    }

    /** Dedicated host lifecycle, independent of Provider and overlay renderers. */
    readonly logViewer = new DetachableWindowSurface({
        retainOnClose: true,
        parent: () => this.host.viewerWindow!,
        focusUnderlying: () => this.host.focusUnderlyingLogViewer(),
        preload: path.resolve(__dirname, '../preload/preload.js'),
        document: path.resolve(__dirname, '../renderer/log-viewer.html'),
        size: { width: 1220, height: 780, minWidth: 720, minHeight: 480 },
        backgroundColor: () =>
            this.host.appTheme === 'dark' ? '#161619' : '#fdfcff',
        onStateChanged: (contents, detached) =>
            contents.send(
                IPC_CHANNELS.logViewer.stateChanged,
                this.getLogViewerState(detached),
            ),
        onCloseRequested: (contents) =>
            contents.send(IPC_CHANNELS.logViewer.requestClose),
    });

    /** Combines native placement with the current app appearance for the log renderer. */
    getLogViewerState(
        detached = this.logViewer.isDetached(),
    ): LogViewerHostState {
        return {
            /** Whether the retained view currently belongs to a separate window. */
            detached,
            visible: this.logViewer.isVisible(),
            /** Current application theme, including preference previews. */
            theme: this.host.appTheme,
            /** Current application locale, including preference previews. */
            locale: this.host.appLocale,
        };
    }

    /** Only the app overlay may open a viewer; only that viewer may move or close itself. */
    async commandLogViewer(
        senderId: number,
        command: unknown,
    ): Promise<LogViewerHostState> {
        const owns = this.logViewer.owns(senderId);
        if (
            command === 'open' &&
            senderId === this.host.overlaySurface?.webContents.id
        ) {
            await this.logViewer.open();
        } else if (owns && command === 'toggle') await this.logViewer.toggle();
        else if (owns && command === 'close') this.logViewer.close();
        else if (!(owns && command === 'state'))
            throw new Error('Invalid log viewer command or sender.');
        return this.getLogViewerState();
    }

    /** The dev tools mode value. */
    devToolsMode: DevToolsMode = 'detach';

    /** The open dev tools on initial site value. */
    openDevToolsOnInitialSite = false;

    /** The keep site dev tools open value. */
    keepSiteDevToolsOpen = false;

    /** The detached dev tools bounds value. */
    detachedDevToolsBounds?: Rectangle;

    /** The configured dev tools contents value. */
    readonly configuredDevToolsContents = new WeakSet<WebContents>();

    /** The configured dev tools Windows value. */
    readonly configuredDevToolsWindows = new WeakSet<BrowserWindow>();

    /** Opens the dev tools. */
    openDevTools(mode: DevToolsMode): void {
        const webContents = this.host.getActiveViewerWebContents();
        if (!webContents || webContents.isDestroyed()) {
            throw new Error('There is no active site view to inspect.');
        }
        this.devToolsMode = mode;
        this.keepSiteDevToolsOpen = true;
        webContents.openDevTools({ mode, activate: true });
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

    /** Opens the active site dev tools. */
    openActiveSiteDevTools(activate: boolean): void {
        const webContents = this.host.getActiveViewerWebContents();
        if (
            !webContents ||
            webContents.isDestroyed() ||
            webContents.isDevToolsOpened()
        ) {
            return;
        }
        webContents.openDevTools({ mode: this.devToolsMode, activate });
    }

    /** Performs the configure dev tools web contents operation. */
    configureDevToolsWebContents(
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
            this.host.connectWindowInput(devToolsContents, 'devtools');
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
        if (devToolsWindow === this.host.viewerWindow) return;
        if (!this.configuredDevToolsWindows.has(devToolsWindow)) {
            this.configuredDevToolsWindows.add(devToolsWindow);
            /** Performs the remember bounds operation. */
            const rememberBounds = () => {
                if (!devToolsWindow.isDestroyed()) {
                    this.detachedDevToolsBounds = devToolsWindow.getBounds();
                }
            };
            bindDevToolsBoundsEvents(devToolsWindow, rememberBounds);
        }
        const bounds = this.detachedDevToolsBounds;
        if (bounds) {
            // DevTools creates its native window asynchronously. Applying the saved
            // rectangle on the next turn keeps its exact monitor and position when
            // a site switch replaces the inspected WebContents.
            setImmediate(() => {
                if (!devToolsWindow.isDestroyed())
                    devToolsWindow.setBounds(bounds, false);
            });
        }
    }
}
