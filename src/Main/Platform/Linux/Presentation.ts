import { type BrowserWindow, type WebContents } from 'electron';

/** Restore the application to normal task switching and Dock presentation. */
export async function restoreApplicationPresentation(): Promise<void> {}

/** Activate the application when a user explicitly brings the viewer forward. */
export function activateApplication(): void {}

/** Prepare the application to display PiP above native fullscreen Spaces. */
export function preparePictureInPicturePresentation(): void {}

/** Taskbar suppression is separate from macOS's process-wide Dock policy. */
export function shouldHidePictureInPictureFromTaskbar(): boolean {
    return true;
}

/** Delayed reassertions needed while native fullscreen Spaces settle. */
export function getPictureInPictureReassertionDelays(): readonly number[] {
    return [];
}

/** Configure the native window level and fullscreen workspace membership. */
export function configurePictureInPictureWindow(
    window: BrowserWindow,
    auxiliary = true,
): void {
    window.setAlwaysOnTop(true, 'screen-saver');
}

/** Show PiP while respecting the platform's fullscreen activation policy. */
export function presentPictureInPicture(
    window: BrowserWindow,
    content?: WebContents,
    raise = false,
): void {
    if (window.isDestroyed()) return;
    window.show();
    if (raise) window.moveTop();
    window.focus();
    content?.focus();
}

/** Undo PiP's native workspace membership before returning to the viewer. */
export async function restorePictureInPicturePresentation(
    window?: BrowserWindow,
    resetWorkspaces = true,
): Promise<void> {}

/** Apply always-on-top and repair a platform-level loss without stealing keyboard focus. */
export function applyViewerAlwaysOnTop(
    window: BrowserWindow,
    enabled: boolean,
    platformReported: boolean | undefined,
    reassert = false,
): boolean {
    window.setAlwaysOnTop(enabled, 'floating');
    return false;
}
