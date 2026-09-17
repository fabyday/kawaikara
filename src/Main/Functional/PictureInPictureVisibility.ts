import type { Point, Rectangle } from 'electron';

/** Minimal native window state shared by internal and Provider PiP. */
export interface PictureInPictureVisibilityWindow {
  /** Whether the native host has been destroyed. */
  isDestroyed(): boolean;
  /** Whether the native host is actually presented. */
  isVisible(): boolean;
  /** Whether the host has been minimized. */
  isMinimized(): boolean;
  /** Current screen-space bounds, including native dragging and resizing. */
  getBounds(): Rectangle;
}

/** App-owned visibility subscription; no DOM hover/focus can override it. */
export interface PictureInPictureVisibilityTracker {
  /** Reconciles current native pointer/window state immediately. */
  sync(): void;
  /** Removes polling and resets the consumer's visible state. */
  dispose(): void;
}

/** Tracks native hover consistently even over Electron app-region drag surfaces. */
export function trackPictureInPictureVisibility(
  window: PictureInPictureVisibilityWindow,
  getCursor: () => Point,
  isActive: () => boolean,
  onChange: (visible: boolean) => void,
): PictureInPictureVisibilityTracker {
  let previous: boolean | undefined;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  /** Publishes the initial state too, so a new session cannot inherit stale UI. */
  const publish = (visible: boolean) => {
    if (previous === visible) return;
    previous = visible;
    onChange(visible);
  };
  /** Stops the single app-owned timer and releases hover state. */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    publish(false);
  };
  /** Samples screen coordinates rather than unreliable DOM mouseleave/:hover. */
  const sync = () => {
    if (disposed) return;
    if (!isActive() || window.isDestroyed()) {
      dispose();
      return;
    }
    const point = getCursor();
    const bounds = window.getBounds();
    publish(window.isVisible() && !window.isMinimized() &&
      point.x >= bounds.x && point.x < bounds.x + bounds.width &&
      point.y >= bounds.y && point.y < bounds.y + bounds.height);
  };
  timer = setInterval(sync, 80);
  timer.unref?.();
  sync();
  return {
    /** Performs immediate native reconciliation. */
    sync,
    /** Disposes the shared native subscription. */
    dispose,
  };
}
