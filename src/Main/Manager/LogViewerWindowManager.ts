import { BrowserWindow, screen, WebContentsView } from 'electron';
import path from 'node:path';
import { IPC_CHANNELS } from '../../Common/IPC';
import type { LogViewerHostState } from '../../Common/LogViewer';
import { transferWebContentsView } from '../Functional/WebContentsViewTransfer';

/** Owns one log renderer, moving it without a reload or a second polling loop. */
export class LogViewerWindowManager {
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

  /** Supplies only the app-owned host and presentation operations. */
  constructor(
    /** Main's existing window; also retained through its closed callback. */
    private readonly parent: () => BrowserWindow,
    /** Restores input to whatever was underneath, without reopening any layer. */
    private readonly focusUnderlying: () => void,
    /** Reads Main's current preference preview. */
    private readonly appearance: () => Omit<LogViewerHostState, 'detached'>,
  ) {}

  /** Validates a caller against the actual renderer instance, not its URL alone. */
  owns(senderId: number): boolean {
    return this.view?.webContents.id === senderId && !this.view.webContents.isDestroyed();
  }

  /** Returns the current native presentation. */
  getState(): LogViewerHostState {
    return {
      /** The presence of an independent host determines the button state. */
      detached: Boolean(this.detachedWindow), ...this.appearance(),
    };
  }

  /** Reports whether the log viewer currently covers the app overlay. */
  isEmbedded(): boolean {
    return Boolean(this.view && !this.detachedWindow && !this.view.webContents.isDestroyed());
  }

  /** Keeps delayed overlay reveals from stealing keyboard focus from the log view. */
  focusEmbedded(): boolean {
    if (!this.isEmbedded()) return false;
    this.view!.webContents.focus();
    return true;
  }

  /** Opens or focuses the one existing log viewer. */
  async open(): Promise<void> {
    if (!this.view) {
      this.disposing = false;
      const view = new WebContentsView({ webPreferences: {
        preload: path.resolve(__dirname, '../preload/preload.js'),
        contextIsolation: true, sandbox: true, nodeIntegration: false,
        backgroundThrottling: false,
      } });
      this.view = view;
      view.setBackgroundColor('#00000000');
      view.setVisible(false);
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      view.webContents.on('will-navigate', (event) => event.preventDefault());
      this.parent().contentView.addChildView(view);
      this.loading = view.webContents.loadFile(path.resolve(__dirname, '../renderer/log-viewer.html'));
    }
    const view = this.view;
    try { await this.loading; }
    catch (error) { if (this.view === view) this.dispose(); throw error; }
    if (this.view !== view || view.webContents.isDestroyed()) return;
    if (this.detachedWindow) {
      if (this.detachedWindow.isMinimized()) this.detachedWindow.restore();
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
    const parent = this.parent();
    if (this.detachedWindow) {
      const detached = this.detachedWindow;
      this.retiringWindow = detached;
      this.detachedWindow = undefined;
      this.notifyAppearance();
      if (parent.isMinimized()) parent.restore();
      await transferWebContentsView({ sourceWindow: detached, targetWindow: parent, view });
      if (this.view !== view || parent.isDestroyed()) return;
      if (!detached.isDestroyed()) detached.destroy();
      this.retiringWindow = undefined;
      parent.show();
      parent.focus();
    } else {
      const workArea = screen.getDisplayMatching(parent.getBounds()).workArea;
      const width = Math.min(1220, workArea.width);
      const height = Math.min(780, workArea.height);
      const detached = new BrowserWindow({
        width, height, minWidth: Math.min(720, width), minHeight: Math.min(480, height),
        x: workArea.x + Math.round((workArea.width - width) / 2),
        y: workArea.y + Math.round((workArea.height - height) / 2),
        frame: false, show: false, autoHideMenuBar: true, acceptFirstMouse: true,
        backgroundColor: this.appearance().theme === 'dark' ? '#161619' : '#fdfcff',
        webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
      });
      detached.setMenu(null);
      this.detachedWindow = detached;
      detached.on('resize', () => this.layout());
      detached.on('close', (event) => {
        if (this.disposing) return;
        event.preventDefault();
        // Let import/delete dialogs apply the same close policy as X and Escape.
        view.webContents.send(IPC_CHANNELS.logViewer.requestClose);
      });
      this.notifyAppearance();
      await transferWebContentsView({ sourceWindow: parent, targetWindow: detached, view });
      if (this.view !== view || detached.isDestroyed()) return;
      detached.show();
      detached.focus();
    }
    view.webContents.invalidate();
    view.webContents.focus();
  }

  /** Keeps an embedded log view above the menu/preferences and sizes either host. */
  layout(): void {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    const host = this.detachedWindow ?? this.parent();
    if (host.isDestroyed()) return;
    if (!this.detachedWindow) host.contentView.addChildView(this.view);
    const [width, height] = host.getContentSize();
    this.view.setBounds({ x: 0, y: 0, width, height });
  }

  /** Applies Main-owned locale/theme changes without restarting the viewer. */
  notifyAppearance(): void {
    if (this.view && !this.view.webContents.isDestroyed()) {
      this.view.webContents.send(IPC_CHANNELS.logViewer.stateChanged, this.getState());
    }
  }

  /** Closes only this layer and restores input to the unchanged underlying screen. */
  close(): void {
    const embedded = !this.detachedWindow;
    this.dispose();
    if (embedded) this.focusUnderlying();
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
      const host = detached ?? this.parent();
      if (!host.isDestroyed()) host.contentView.removeChildView(view);
      view.webContents.close();
    }
    if (detached && !detached.isDestroyed()) detached.destroy();
    if (retiring && !retiring.isDestroyed()) retiring.destroy();
  }
}
