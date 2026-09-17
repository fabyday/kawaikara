import type { DirectoryNavigationDirection } from '../Common/VideoDirectoryHistory';

/** Subscribes while the folder browser is mounted, without navigating video.html. */
export function subscribeDirectoryNavigation(
  handler: (direction: DirectoryNavigationDirection) => void,
  platform: string,
  subscribeNative: (
    callback: (direction: DirectoryNavigationDirection) => void,
  ) => () => void,
): () => void {
  const unsubscribe = subscribeNative(handler);
  /** Suppresses Chromium's document-history action for physical side buttons. */
  const mouse = (event: MouseEvent) => {
    if (event.button !== 3 && event.button !== 4) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Windows/Linux deliver these through BrowserWindow's app-command. Do not
    // consume both that command and a DOM mouse event for a single press.
    if (platform === 'darwin' && event.type === 'mouseup') {
      handler(event.button === 3 ? 'back' : 'forward');
    }
  };
  for (const type of ['mousedown', 'mouseup', 'auxclick'] as const) {
    window.addEventListener(type, mouse, true);
  }
  return () => {
    unsubscribe();
    for (const type of ['mousedown', 'mouseup', 'auxclick'] as const) {
      window.removeEventListener(type, mouse, true);
    }
  };
}
