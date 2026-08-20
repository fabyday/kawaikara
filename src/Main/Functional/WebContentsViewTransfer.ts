import type { BrowserWindow, Rectangle, WebContentsView } from 'electron';
import { WAIT_FOR_VISIBLE_RENDERER_FRAMES_SCRIPT } from '../Inject/RendererFrames';
const RENDERER_FRAME_WAIT_TIMEOUT_MS = 250;

export interface WebContentsViewTransferOptions {
  readonly sourceWindow?: BrowserWindow;
  readonly targetWindow: BrowserWindow;
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

export function getWindowContentViewBounds(window: BrowserWindow): Rectangle {
  const [width, height] = window.getContentSize();
  return { x: 0, y: 0, width, height };
}

async function waitForVisibleRendererFrames(
  view: WebContentsView,
): Promise<void> {
  if (view.webContents.isDestroyed()) return;

  await new Promise<void>((resolve) => {
    let settled = false;
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
