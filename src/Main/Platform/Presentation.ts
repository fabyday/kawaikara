import * as darwin from './Darwin/Presentation';
import * as linux from './Linux/Presentation';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/Presentation';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Restore the application to normal task switching and Dock presentation. */
export const restoreApplicationPresentation =
    implementation.restoreApplicationPresentation;

/** Activate the application when a user explicitly brings the viewer forward. */
export const activateApplication = implementation.activateApplication;

/** Prepare the application to display PiP above native fullscreen Spaces. */
export const preparePictureInPicturePresentation =
    implementation.preparePictureInPicturePresentation;

/** Taskbar suppression is separate from macOS's process-wide Dock policy. */
export const shouldHidePictureInPictureFromTaskbar =
    implementation.shouldHidePictureInPictureFromTaskbar;

/** Delayed reassertions needed while native fullscreen Spaces settle. */
export const getPictureInPictureReassertionDelays =
    implementation.getPictureInPictureReassertionDelays;

/** Configure the native window level and fullscreen workspace membership. */
export const configurePictureInPictureWindow =
    implementation.configurePictureInPictureWindow;

/** Show PiP while respecting the platform's fullscreen activation policy. */
export const presentPictureInPicture = implementation.presentPictureInPicture;

/** Undo PiP's native workspace membership before returning to the viewer. */
export const restorePictureInPicturePresentation =
    implementation.restorePictureInPicturePresentation;

/** Apply always-on-top and repair a platform-level loss without stealing keyboard focus. */
export const applyViewerAlwaysOnTop = implementation.applyViewerAlwaysOnTop;
