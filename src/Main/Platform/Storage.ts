import * as darwin from './Darwin/Storage';
import * as linux from './Linux/Storage';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/Storage';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Read an installed application data locator. */
export const readInstalledDataRoot = implementation.readInstalledDataRoot;

/** Validate a data location using native installer rules. */
export const resolveDataRootSelection = implementation.resolveDataRootSelection;

/** Persist the next-launch data locator. */
export const writeInstalledDataRoot = implementation.writeInstalledDataRoot;

/** Whether custom persistent data locations are supported. */
export const supportsCustomDataLocation =
    implementation.supportsCustomDataLocation;

/** Normalize paths for native filesystem comparison. */
export const normalizeFilePathKey = implementation.normalizeFilePathKey;

/** Return the display label of a filesystem root. */
export const getFileSystemRootLabel = implementation.getFileSystemRootLabel;

/** Enumerate accessible filesystem roots. */
export const listFileSystemRoots = implementation.listFileSystemRoots;
