import { access } from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { BrowserId } from '../Browsers';
const exec = promisify(execFile);
/** Finds installer registrations before checking per-user and system install paths. */
export async function findBrowser(id: BrowserId): Promise<string | undefined> {
    const exe = id === 'chrome' ? 'chrome.exe' : 'firefox.exe';
    const candidates: string[] = [];
    for (const hive of ['HKCU', 'HKLM']) {
        try {
            const { stdout } = await exec(
                'reg.exe',
                [
                    'query',
                    `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`,
                    '/ve',
                ],
                { windowsHide: true, timeout: 3000 },
            );
            const value = stdout
                .match(/REG_SZ\s+(.+)/)?.[1]
                ?.trim()
                .replace(/^"|"$/g, '');
            if (value && path.basename(value).toLowerCase() === exe)
                candidates.push(value);
        } catch {}
    }
    for (const root of [
        process.env.LOCALAPPDATA,
        process.env.ProgramFiles,
        process.env['ProgramFiles(x86)'],
    ])
        if (root)
            candidates.push(
                path.join(
                    root,
                    id === 'chrome'
                        ? 'Google/Chrome/Application/chrome.exe'
                        : 'Mozilla Firefox/firefox.exe',
                ),
            );
    for (const candidate of candidates) {
        try {
            await access(candidate);
            return candidate;
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
