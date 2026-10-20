import type { BrowserWindow, WebContentsView } from 'electron';

/** Attaches or raises a caller-owned surface without loading or recreating its renderer. */
export function attachWindowSurface(
    window: BrowserWindow | undefined,
    surface: WebContentsView,
): void {
    if (!window || window.isDestroyed() || surface.webContents.isDestroyed())
        return;
    window.contentView.addChildView(surface);
}

/** Detaches presentation only; renderer and playback lifetime stay with their owner. */
export function detachWindowSurface(
    window: BrowserWindow | undefined,
    surface: WebContentsView,
): void {
    if (!window || window.isDestroyed()) return;
    window.contentView.removeChildView(surface);
}
