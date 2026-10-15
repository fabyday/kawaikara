import * as darwin from './Darwin/DefaultBrowser';
import * as linux from './Linux/DefaultBrowser';
import { selectPlatform } from './Runtime';
import * as windows from './Windows/DefaultBrowser';

/** Native browser launcher for this OS. */
const implementation = selectPlatform({
    /** Native Apple desktop integration. */
    darwin,
    /** Native Windows desktop integration. */
    win32: windows,
    /** Native Linux desktop integration. */
    linux,
});

/**
 * Open a web URL with the operating system's registered default browser.
 * Keeping this in Main also prevents remote page content from invoking
 * arbitrary external protocols through Electron's shell API.
 */
export async function openInDefaultBrowser(value: string): Promise<void> {
    const target = new URL(value);
    if (
        (target.protocol !== 'https:' && target.protocol !== 'http:') ||
        target.username ||
        target.password
    ) {
        throw new Error(
            'Only credential-free HTTP(S) URLs can open externally.',
        );
    }
    await implementation.openInDefaultBrowser(target.href);
}
