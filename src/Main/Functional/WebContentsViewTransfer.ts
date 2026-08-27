import type { BrowserWindow, Rectangle, WebContentsView } from 'electron';
import { WAIT_FOR_VISIBLE_RENDERER_FRAMES_SCRIPT } from '../Inject/RendererFrames';
/** Defines the shared renderer frame wait timeout ms constant. */
const RENDERER_FRAME_WAIT_TIMEOUT_MS = 250;

/** Describes the web contents view transfer options contract. */
export interface WebContentsViewTransferOptions {
  /** The source window value. */
  readonly sourceWindow?: BrowserWindow;
  /** The target window value. */
  readonly targetWindow: BrowserWindow;
  /** The view value. */
  readonly view: WebContentsView;
}

/**
 * Reparents a WebContentsView only after its target native window is visible,
 * then gives Chromium time to submit frames for the new view hierarchy. Keeping
 * this sequence platform-neutral avoids separate macOS and Windows PiP flows.
 */
export async function transferWebContentsView({
  sourceWindow,
  targetWindow,
  view,
}: WebContentsViewTransferOptions): Promise<void> {
  if (targetWindow.isDestroyed()) {
    throw new Error('Cannot transfer a WebContentsView to a destroyed window.');
  }
  if (view.webContents.isDestroyed()) {
    throw new Error('Cannot transfer a destroyed WebContentsView.');
  }

  // A visible target gives Chromium a native surface to attach to before the
  // source host is retired. showInactive avoids stealing focus mid-transition.
  targetWindow.showInactive();
  if (sourceWindow && !sourceWindow.isDestroyed()) {
    sourceWindow.contentView.removeChildView(view);
  }
  targetWindow.contentView.addChildView(view);
  view.setBounds(getWindowContentViewBounds(targetWindow));
  view.webContents.invalidate();

  await waitForVisibleRendererFrames(view);
}

/** Returns the window content view bounds. */
export function getWindowContentViewBounds(window: BrowserWindow): Rectangle {
  const [width, height] = window.getContentSize();
  return {
    /** The x value. */
    x: 0,
    /** The y value. */
    y: 0,
    /** The width value. */
    width,
    /** The height value. */
    height,
  };
}

/** Waits for the for visible renderer frames. */
async function waitForVisibleRendererFrames(
  view: WebContentsView,
): Promise<void> {
  if (view.webContents.isDestroyed()) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    /** Performs the finish operation. */
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      console.debug('WebContentsView frame synchronization timed out.');
      finish();
    }, RENDERER_FRAME_WAIT_TIMEOUT_MS);

    void view.webContents
      .executeJavaScript(WAIT_FOR_VISIBLE_RENDERER_FRAMES_SCRIPT)
      .catch((error: unknown) => {
        // Navigation or renderer shutdown can invalidate an in-flight frame
        // wait. The caller still needs to complete native-window cleanup.
        console.debug('WebContentsView frame synchronization was skipped.', error);
      })
      .then(finish);
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
}
