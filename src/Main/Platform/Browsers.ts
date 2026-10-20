import { stat, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import * as darwin from './Darwin/Browsers';
import * as windows from './Windows/Browsers';
import * as linux from './Linux/Browsers';
import { selectPlatform } from './Runtime';
/** Browsers supported by the external adapter. */
export type BrowserId = 'chrome' | 'firefox';
/** Stores the native value. */
const native = selectPlatform({
    /** The darwin value. */
    darwin,
    /** The win32 value. */
    win32: windows,
    /** The linux value. */
    linux,
});
/** Public browser choice without native executable or profile paths. */
export interface SupportedBrowser {
    /** Stable supported browser identifier. */
    readonly id: BrowserId;
    /** User-visible browser name. */
    readonly name: string;
}

/** Discovers installed supported browsers without exposing executable paths. */
export async function listSupportedBrowsers(): Promise<SupportedBrowser[]> {
    const ids: BrowserId[] = ['chrome', 'firefox'];
    const found = await Promise.all(
        ids.map(async (id) =>
            (await native.findBrowser(id))
                ? {
                      /** Supported browser identifier. */ id,
                      /** Display name for browser selection. */ name:
                          id === 'chrome' ? 'Chrome' : 'Firefox',
                  }
                : undefined,
        ),
    );
    return found.filter((browser): browser is NonNullable<typeof browser> =>
        Boolean(browser),
    );
}
/** Launches only a discovered supported browser with a loopback pairing URL. */
export async function openBrowser(id: string, value: string): Promise<void> {
    if (id !== 'chrome' && id !== 'firefox')
        throw new Error('Unsupported browser.');
    const url = new URL(value);
    if (
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        url.username ||
        url.password ||
        url.pathname !== '/extension-connect'
    )
        throw new Error('Invalid pairing URL.');
    const executable = await native.findBrowser(id);
    if (!executable) throw new Error('Browser is no longer installed.');
    await native.openBrowser(executable, url.href);
}

/** Launches an application chosen through the trusted native picker; never accepts a renderer path. */
export async function openSelectedBrowser(
    application: string,
    value: string,
): Promise<void> {
    const url = new URL(value);
    if (
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        url.pathname !== '/extension-connect' ||
        url.username ||
        url.password
    )
        throw new Error('Invalid pairing URL.');
    const info = await stat(application);
    if (process.platform === 'darwin') {
        if (!application.endsWith('.app') || !info.isDirectory())
            throw new Error('Choose a browser application bundle.');
    } else {
        if (
            !info.isFile() ||
            (process.platform === 'win32' &&
                !application.toLowerCase().endsWith('.exe'))
        )
            throw new Error('Choose a browser executable.');
        if (process.platform === 'linux')
            await access(application, constants.X_OK);
    }
    await native.openBrowser(application, url.href);
}
