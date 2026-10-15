import * as darwin from './Darwin/Graphics';
import * as linux from './Linux/Graphics';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/Graphics';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Configure native overlays so video remains capturable. */
export const configureCaptureCompatibleGraphics =
    implementation.configureCaptureCompatibleGraphics;

/** Whether this target ships a native video backend. */
export const hasNativeVideoBackend = implementation.hasNativeVideoBackend;

/** Whether the retained video surface needs warming before activation. */
export const shouldPrewarmVideoSurface =
    implementation.shouldPrewarmVideoSurface;
