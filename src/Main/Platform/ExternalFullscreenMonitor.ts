export type {
    ExternalFullscreenChanged,
    ExternalFullscreenMonitor,
} from './FullscreenMonitor';

import * as darwin from './Darwin/ExternalFullscreenMonitor';
import * as linux from './Linux/ExternalFullscreenMonitor';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/ExternalFullscreenMonitor';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Create a fullscreen monitor without exposing the native implementation. */
export const createExternalFullscreenMonitor =
    implementation.createExternalFullscreenMonitor;
