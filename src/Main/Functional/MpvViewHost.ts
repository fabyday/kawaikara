import { EventEmitter } from 'node:events';
import type { BrowserWindow, WebContentsView } from 'electron';

/**
 * Adapts a Video view to electron-mpv-video 0.1.1's BrowserWindow-only host
 * interface. That package uses the host's WebContents, destroyed state, and
 * closed event; the playback renderer and libmpv remain unmodified.
 */
export function createMpvViewHost(view: WebContentsView): BrowserWindow {
  const contents = view.webContents;
  const events = new EventEmitter();
  contents.once('destroyed', () => events.emit('closed'));
  return Object.assign(events, {
    /** The actual Video renderer authorized to create a libmpv session. */
    webContents: contents,
    /** Mirrors the renderer lifetime expected by the stock window API. */
    isDestroyed: () => contents.isDestroyed(),
  }) as BrowserWindow;
}
