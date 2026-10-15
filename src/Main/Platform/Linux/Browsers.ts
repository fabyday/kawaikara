import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { BrowserId } from '../Browsers';
const exec = promisify(execFile);
/** Resolves supported executable names through the user's application search path. */
export async function findBrowser(id: BrowserId): Promise<string | undefined> {
    for (const name of id === 'chrome'
        ? ['google-chrome', 'google-chrome-stable']
        : ['firefox']) {
        try {
            const { stdout } = await exec('which', [name], { timeout: 3000 });
            const path = stdout.trim().split('\n')[0];
            if (path.startsWith('/')) return path;
        } catch {}
    }
    return undefined;
}
/** Starts the known executable without invoking a command shell. */
export async function openBrowser(
    executable: string,
    url: string,
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(executable, [url], {
            detached: true,
            stdio: 'ignore',
        });
        child.once('error', reject);
        child.once('spawn', () => {
            child.unref();
            resolve();
        });
    });
}
