import { app, type BrowserWindow, type WebContents } from 'electron';
import {
    enableMacOSFullScreenAuxiliary,
    disableMacOSFullScreenAuxiliary,
} from '../macOS/WindowSpaces';

/** Restore the application to normal task switching and Dock presentation. */
export async function restoreApplicationPresentation(): Promise<void> {
    if (process.platform !== 'darwin') return;
    app.setActivationPolicy('regular');
    await app.dock?.show();
}

/** Activate the application when a user explicitly brings the viewer forward. */
export function activateApplication(): void {
    if (process.platform === 'darwin') app.focus({ steal: true });
}

/** Prepare the application to display PiP above native fullscreen Spaces. */
export function preparePictureInPicturePresentation(): void {
    if (process.platform !== 'darwin') return;
    app.setActivationPolicy('accessory');
    app.dock?.hide();
}

/** Taskbar suppression is separate from macOS's process-wide Dock policy. */
export function shouldHidePictureInPictureFromTaskbar(): boolean {
    return process.platform !== 'darwin';
}

/** Delayed reassertions needed while native fullscreen Spaces settle. */
export function getPictureInPictureReassertionDelays(): readonly number[] {
    return process.platform === 'darwin' ? [0, 250, 1_000] : [];
}

/** Configure the native window level and fullscreen workspace membership. */
export function configurePictureInPictureWindow(
    window: BrowserWindow,
    auxiliary = true,
): void {
    window.setAlwaysOnTop(true, 'screen-saver');
    if (process.platform !== 'darwin') return;
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
    if (process.platform === 'darwin') {
        preparePictureInPicturePresentation();
        configurePictureInPictureWindow(window);
        window.showInactive();
        window.moveTop();
    } else {
        window.show();
        if (raise) window.moveTop();
        window.focus();
        content?.focus();
    }
}

/** Undo PiP's native workspace membership before returning to the viewer. */
export async function restorePictureInPicturePresentation(
    window?: BrowserWindow,
    resetWorkspaces = true,
): Promise<void> {
    if (process.platform !== 'darwin') return;
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
    const electronReported = window.isAlwaysOnTop();
    const presentationWasLost =
        process.platform === 'win32' &&
        enabled &&
        electronReported &&
        platformReported === false;
    const raise =
        process.platform === 'win32' &&
        enabled &&
        (reassert || presentationWasLost || !electronReported);
    // Windows can clear WS_EX_TOPMOST while Electron retains its cached level.
    if (presentationWasLost) window.setAlwaysOnTop(false);
    window.setAlwaysOnTop(
        enabled,
        process.platform === 'win32' ? 'screen-saver' : 'floating',
    );
    if (
        process.platform === 'darwin' &&
        window.isVisibleOnAllWorkspaces() !== enabled
    ) {
        window.setVisibleOnAllWorkspaces(enabled, {
            visibleOnFullScreen: false,
            skipTransformProcessType: true,
        });
    }
    if (raise && window.isVisible() && !window.isMinimized()) window.moveTop();
    return presentationWasLost;
}
