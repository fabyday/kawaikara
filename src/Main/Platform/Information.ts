import * as darwin from './Darwin/Information';
import * as linux from './Linux/Information';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/Information';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Return a user-facing operating system name and release. */
export const getOperatingSystemLabel = implementation.getOperatingSystemLabel;
