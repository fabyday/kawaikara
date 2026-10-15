import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BrowserId } from '../Browsers';
const exec = promisify(execFile);
/** Locates the signed application bundle, including nonstandard Spotlight locations. */
export async function findBrowser(id: BrowserId): Promise<string | undefined> {
    const name = id === 'chrome' ? 'Google Chrome' : 'Firefox';
    for (const root of ['/Applications', `${homedir()}/Applications`]) {
        const path = `${root}/${name}.app`;
        try {
            await access(path);
            return path;
        } catch {}
    }
    const bundle =
        id === 'chrome' ? 'com.google.Chrome' : 'org.mozilla.firefox';
    try {
        const { stdout } = await exec(
            '/usr/bin/mdfind',
            [`kMDItemCFBundleIdentifier == "${bundle}"`],
            { timeout: 3000 },
        );
        for (const path of stdout.trim().split('\n'))
            if (path.endsWith('.app')) {
                await access(path);
                return path;
            }
    } catch {}
    return undefined;
}
/** LaunchServices passes the URL to the selected application. */
export async function openBrowser(bundle: string, url: string): Promise<void> {
    await exec('/usr/bin/open', ['-a', bundle, url]);
}
