import * as darwin from './Darwin/Keyboard';
import * as linux from './Linux/Keyboard';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/Keyboard';

/** Implementation selected at the platform boundary. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/** Modifier used for standard application shortcuts. */
export const getPrimaryShortcutModifier =
    implementation.getPrimaryShortcutModifier;

/** Whether the editing menu supports Control+Y for redo. */
export const supportsRedoWithY = implementation.supportsRedoWithY;
