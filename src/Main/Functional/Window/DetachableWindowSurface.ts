import {
    BrowserWindow,
    screen,
    WebContentsView,
    type WebContents,
} from 'electron';
import {
    transferWebContentsView,
    waitForVisibleRendererFrames,
} from './WebContentsViewTransfer';

/** App-owned renderer configuration, independent of its feature's IPC or state. */
export interface DetachableWindowSurfaceOptions {
    /** Main window that hosts the embedded surface. */
    readonly parent: () => BrowserWindow;
    /** Restores input to the screen underneath after an embedded close. */
    readonly focusUnderlying: () => void;
    /** Absolute path to the app-owned preload. */
    readonly preload: string;
    /** Absolute path to the app-owned renderer document. */
    readonly document: string;
    /** Initial and minimum detached sizes, clamped to the current display. */
    readonly size: {
        /** Preferred detached width in device-independent pixels. */
        readonly width: number;
        /** Preferred detached height in device-independent pixels. */
        readonly height: number;
        /** Minimum detached width, limited by the display work area. */
        readonly minWidth: number;
        /** Minimum detached height, limited by the display work area. */
        readonly minHeight: number;
    };
    /** Resolves the current detached-window background at creation. */
    readonly backgroundColor: () => string;
    /** Updates the feature's renderer state before and after native reparenting. */
    readonly onStateChanged: (contents: WebContents, detached: boolean) => void;
    /** Delegates native close requests to the feature's own confirmation policy. */
    readonly onCloseRequested: (contents: WebContents) => void;
}

/** Owns one app surface and its native hosts without reloading the renderer. */
export class DetachableWindowSurface {
    /** Retained until the viewer is explicitly closed. */
    private view?: WebContentsView;
    /** Independent host, present only while detached. */
    private detachedWindow?: BrowserWindow;
    /** Initial navigation shared by concurrent open commands. */
    private loading?: Promise<void>;
    /** Coalesces repeated clicks until native reparenting and painting finish. */
    private moving?: Promise<void>;
    /** Keeps the source host alive until the embedded surface is presented. */
    private retiringWindow?: BrowserWindow;
    /** Prevents close handlers from interfering with teardown. */
    private disposing = false;

    /** Captures presentation configuration without creating native resources. */
    constructor(
        /** Native host configuration and feature-owned presentation callbacks. */
        private readonly options: DetachableWindowSurfaceOptions,
    ) {}

    /** Validates a caller against the actual renderer instance, not its URL alone. */
    owns(senderId: number): boolean {
        return (
            this.view?.webContents.id === senderId &&
            !this.view.webContents.isDestroyed()
        );
    }

    /** Reports whether the retained renderer has its own native host. */
    isDetached(): boolean {
        return Boolean(this.detachedWindow);
    }

    /** Reports whether the surface currently covers the app overlay. */
    isEmbedded(): boolean {
        return Boolean(
            this.view &&
            !this.detachedWindow &&
            !this.view.webContents.isDestroyed(),
        );
    }

    /** Keeps delayed overlay reveals from stealing keyboard focus from the surface. */
    focusEmbedded(): boolean {
        if (!this.isEmbedded()) return false;
        this.view!.webContents.focus();
        return true;
    }

    /** Opens or focuses the one existing surface. */
    async open(): Promise<void> {
        if (!this.view) {
            this.disposing = false;
            const view = new WebContentsView({
                webPreferences: {
                    preload: this.options.preload,
                    contextIsolation: true,
                    sandbox: true,
                    nodeIntegration: false,
                    backgroundThrottling: false,
                },
            });
            this.view = view;
            view.setBackgroundColor('#00000000');
            view.setVisible(false);
            view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            view.webContents.on('will-navigate', (event) =>
                event.preventDefault(),
            );
            this.options.parent().contentView.addChildView(view);
            this.loading = view.webContents.loadFile(this.options.document);
        }
        const view = this.view;
        try {
            await this.loading;
        } catch (error) {
            if (this.view === view) this.dispose();
            throw error;
        }
        if (this.view !== view || view.webContents.isDestroyed()) return;
        if (this.detachedWindow) {
            if (this.detachedWindow.isMinimized())
                this.detachedWindow.restore();
            this.detachedWindow.show();
        }
        this.layout();
        view.setVisible(true);
        view.webContents.focus();
    }

    /** Moves the existing WebContentsView; no renderer state is serialized or lost. */
    toggle(): Promise<void> {
        if (this.moving) return this.moving;
        const moving = this.move().finally(() => {
            if (this.moving === moving) this.moving = undefined;
        });
        this.moving = moving;
        return moving;
    }

    /** Presents the retained renderer before retiring its old native host. */
    private async move(): Promise<void> {
        const view = this.view;
        if (!view || view.webContents.isDestroyed()) return;
        const parent = this.options.parent();
        if (this.detachedWindow) {
            const detached = this.detachedWindow;
            this.retiringWindow = detached;
            // Clear native drag regions while the renderer still belongs to its old host.
            this.notifyState(false);
            await waitForVisibleRendererFrames(view);
            if (this.view !== view || parent.isDestroyed()) return;
            this.detachedWindow = undefined;
            if (parent.isMinimized()) parent.restore();
            await transferWebContentsView({
                sourceWindow: detached,
                targetWindow: parent,
                view,
                onTransferred: () => this.notifyState(),
            });
            if (this.view !== view || parent.isDestroyed()) return;
            if (!detached.isDestroyed()) detached.destroy();
            this.retiringWindow = undefined;
            parent.show();
            parent.focus();
        } else {
            const workArea = screen.getDisplayMatching(
                parent.getBounds(),
            ).workArea;
            const width = Math.min(this.options.size.width, workArea.width);
            const height = Math.min(this.options.size.height, workArea.height);
            const detached = new BrowserWindow({
                width,
                height,
                minWidth: Math.min(this.options.size.minWidth, width),
                minHeight: Math.min(this.options.size.minHeight, height),
                x: workArea.x + Math.round((workArea.width - width) / 2),
                y: workArea.y + Math.round((workArea.height - height) / 2),
                frame: false,
                show: false,
                autoHideMenuBar: true,
                acceptFirstMouse: true,
                backgroundColor: this.options.backgroundColor(),
                webPreferences: {
                    contextIsolation: true,
                    sandbox: true,
                    nodeIntegration: false,
                },
            });
            detached.setMenu(null);
            this.detachedWindow = detached;
            detached.on('resize', () => this.layout());
            detached.on('close', (event) => {
                if (this.disposing) return;
                event.preventDefault();
                // Native close follows the same feature policy as the renderer's close button.
                this.options.onCloseRequested(view.webContents);
            });
            await transferWebContentsView({
                sourceWindow: parent,
                targetWindow: detached,
                view,
                onTransferred: () => this.notifyState(),
            });
            if (this.view !== view || detached.isDestroyed()) return;
            detached.show();
            detached.focus();
        }
        view.webContents.invalidate();
        view.webContents.focus();
    }

    /** Keeps an embedded surface above the menu/preferences and sizes either host. */
    layout(): void {
        if (!this.view || this.view.webContents.isDestroyed()) return;
        const host = this.detachedWindow ?? this.options.parent();
        if (host.isDestroyed()) return;
        if (!this.detachedWindow) host.contentView.addChildView(this.view);
        const [width, height] = host.getContentSize();
        this.view.setBounds({ x: 0, y: 0, width, height });
    }

    /** Publishes host or feature state without restarting the renderer. */
    notifyState(detached = Boolean(this.detachedWindow)): void {
        if (this.view && !this.view.webContents.isDestroyed()) {
            this.options.onStateChanged(this.view.webContents, detached);
        }
    }

    /** Closes only this layer and restores input to the unchanged underlying screen. */
    close(): void {
        const embedded = !this.detachedWindow;
        this.dispose();
        if (embedded) this.options.focusUnderlying();
    }

    /** Releases both the retained renderer and detached host on app shutdown. */
    dispose(): void {
        this.disposing = true;
        const view = this.view;
        const detached = this.detachedWindow;
        const retiring = this.retiringWindow;
        this.view = undefined;
        this.detachedWindow = undefined;
        this.loading = undefined;
        this.retiringWindow = undefined;
        this.moving = undefined;
        if (view && !view.webContents.isDestroyed()) {
            const host = detached ?? this.options.parent();
            if (!host.isDestroyed()) host.contentView.removeChildView(view);
            view.webContents.close();
        }
        if (detached && !detached.isDestroyed()) detached.destroy();
        if (retiring && !retiring.isDestroyed()) retiring.destroy();
    }
}
