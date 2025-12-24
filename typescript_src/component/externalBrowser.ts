// externalBrowser.ts
// depend on patchwright(This is a variant of Playwright)

import { chromium } from 'patchright';
import { global_object } from '../data/context';

export interface ExternalBrowserDescriptor {
    /**
     * if url is undefined, then empty page will be loaded.
     */
    url?: string;
    persist?: boolean;
    waitForCallback?: { url: string; timeout?: string };
}

/**
 *
 * @param desc
 */
export async function launchExternalBrowser({
    url,
    persist = false,
    waitForCallback,
}: ExternalBrowserDescriptor) {
    // if path was undeifend or invalid then use stateless browser

    if (typeof global_object.externalBrowser === 'undefined') {
        global_object.externalBrowser = {};
    }

    if (persist) {
        global_object.externalBrowser.browserContext =
            await chromium.launchPersistentContext(
                global_object.externalBrowser?.dataPath!,
            );
    } else {
        global_object.externalBrowser.browser = await chromium.launch({});
    }
}

async function createOrAttach() {}

/**
 *
 * set External Browser(Chrome) user Infos save path.
 * this fucntion Must be called before calling @function openExternalBrowser
 * App Must call this function at initialization.
 * @param path
 */
export async function setExternalBrowserDataPath(path: string) {
    if (typeof global_object.externalBrowser === 'undefined') {
        global_object.externalBrowser = {};
    }
    global_object.externalBrowser.dataPath = path;
}
