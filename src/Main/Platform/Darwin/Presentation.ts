import { app, type BrowserWindow, type WebContents } from 'electron';
import {
    disableMacOSFullScreenAuxiliary,
    enableMacOSFullScreenAuxiliary,
} from './WindowSpaces';

/** Restore the application to normal task switching and Dock presentation. */
export async function restoreApplicationPresentation(): Promise<void> {
    app.setActivationPolicy('regular');
    await app.dock?.show();
}

/** Activate the application when a user explicitly brings the viewer forward. */
export function activateApplication(): void {
    app.focus({ steal: true });
}

/** Prepare the application to display PiP above native fullscreen Spaces. */
export function preparePictureInPicturePresentation(): void {
    app.setActivationPolicy('accessory');
    app.dock?.hide();
}

/** Taskbar suppression is separate from macOS's process-wide Dock policy. */
export function shouldHidePictureInPictureFromTaskbar(): boolean {
    return false;
}

/** Delayed reassertions needed while native fullscreen Spaces settle. */
export function getPictureInPictureReassertionDelays(): readonly number[] {
    return [0, 250, 1_000];
}

/** Configure the native window level and fullscreen workspace membership. */
export function configurePictureInPictureWindow(
    window: BrowserWindow,
    auxiliary = true,
): void {
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (auxiliary) enableMacOSFullScreenAuxiliary(window);
}

/** Show PiP while respecting the platform's fullscreen activation policy. */
export function presentPictureInPicture(
    window: BrowserWindow,
    content?: WebContents,
    raise = false,
): void {
    if (window.isDestroyed()) return;
    preparePictureInPicturePresentation();
    configurePictureInPictureWindow(window);
    window.showInactive();
    window.moveTop();
}

/** Undo PiP's native workspace membership before returning to the viewer. */
export async function restorePictureInPicturePresentation(
    window?: BrowserWindow,
    resetWorkspaces = true,
): Promise<void> {
    if (window && !window.isDestroyed()) {
        disableMacOSFullScreenAuxiliary(window);
        if (resetWorkspaces)
            window.setVisibleOnAllWorkspaces(false, {
                visibleOnFullScreen: false,
            });
    }
    await restoreApplicationPresentation();
}

/** Apply always-on-top and repair a platform-level loss without stealing keyboard focus. */
export function applyViewerAlwaysOnTop(
    window: BrowserWindow,
    enabled: boolean,
    platformReported: boolean | undefined,
    reassert = false,
): boolean {
    window.setAlwaysOnTop(enabled, 'floating');
    if (window.isVisibleOnAllWorkspaces() !== enabled) {
        window.setVisibleOnAllWorkspaces(enabled, {
            visibleOnFullScreen: false,
            skipTransformProcessType: true,
        });
    }
    return false;
}
