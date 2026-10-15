import * as darwin from './Darwin/DefaultVideoApp';
import * as linux from './Linux/DefaultVideoApp';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/DefaultVideoApp';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Whether native default-video-app settings are available. */
export const canConfigureDefaultVideoApp =
    implementation.canConfigureDefaultVideoApp;

/** Open OS-owned consent settings for this installed application. */
export const openDefaultVideoAppSettings =
    implementation.openDefaultVideoAppSettings;

/** Return the optional default-video-app settings capability. */
export const getDefaultVideoAppCapability =
    implementation.getDefaultVideoAppCapability;
