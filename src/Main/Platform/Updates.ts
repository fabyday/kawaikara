export type { UpdateLogger } from './UpdateLogger';

import * as darwin from './Darwin/Updates';
import * as linux from './Linux/Updates';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/Updates';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Configure native downloaded-code verification and installation. */
export const configureUpdateInstaller = implementation.configureUpdateInstaller;

/** Whether the native installer supports an in-app consent flow. */
export const shouldInstallUpdateSilently =
    implementation.shouldInstallUpdateSilently;

/** Wait for native staging before application shutdown. */
export const prepareNativeUpdate = implementation.prepareNativeUpdate;
