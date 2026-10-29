import { app, shell } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import path from 'node:path';

/** Installed native application metadata, without product-specific discovery paths. */
export interface InstalledExternalApplication {
    /** Native app bundle path when discoverable. */
    readonly path?: string;
    /** Native version when available. */
    readonly version?: string;
}
/** Executes an OS utility without a shell or unbounded execution time. */
const run = promisify(execFile);

/**
 * Inspects a macOS bundle against its expected application identity.
 * @param appPath - Candidate bundle path from native discovery or isolated installation.
 * @param appId - Expected CFBundleIdentifier from the registered integration.
 * @returns Validated metadata or null when absent, malformed or another application.
 */
export async function inspectMacApp(appPath: string, appId: string,
): Promise<InstalledExternalApplication | null> {
    try {
        if (!(await stat(appPath)).isDirectory()) return null;
        const plist = path.join(appPath, 'Contents', 'Info.plist');
        const id = await run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist], { timeout: 5000 });
        if (id.stdout.trim() !== appId) return null;
        const version = await run('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', plist], { timeout: 5000 });
        return {
            /** The path value. */
            path: appPath,
            /** The version value. */
            version: version.stdout.trim() || undefined
        };
    } catch { return null; }
}

/**
 * Rechecks OS registration using only the Provider-supplied product identity and scheme.
 * @param appId - Validated application ID, also the expected macOS bundle identity.
 * @param protocol - Validated custom URL scheme owned by the integration.
 * @returns Installed metadata or undefined; isolated tests never fall back to real apps.
 */
export async function findExternalApplication(appId: string, protocol: string): Promise<InstalledExternalApplication | undefined> {
    if (typeof __KAWAIKARA_EXTERNAL_APP_TESTING__ !== 'undefined' && __KAWAIKARA_EXTERNAL_APP_TESTING__) {
        const testing = require('../Functional/ExternalApps/Distribution/InstallTesting') as typeof import('../Functional/ExternalApps/Distribution/InstallTesting');
        if (testing.installationTestPaths(appId)) return (await testing.findTestApplication(appId)) ?? undefined;
    }
    try {
        if (process.platform === 'darwin') {
            const found = await run('/usr/bin/mdfind', [`kMDItemCFBundleIdentifier == "${appId}"`], { timeout: 5000 });
            for (const candidate of found.stdout.split('\n').filter(Boolean)) {
                const installed = await inspectMacApp(candidate, appId);
                if (installed) return installed;
            }
            const handler = await app.getApplicationInfoForProtocol(`${protocol}://`);
            return handler.path ? (await inspectMacApp(handler.path, appId)) ?? undefined : undefined;
        }
        if (process.platform === 'win32') {
            await run('reg.exe', ['query', `HKCR\\${protocol}\\shell\\open\\command`, '/ve'], { timeout: 5000 });
            return {};
        }
        const found = await run('xdg-mime', ['query', 'default', `x-scheme-handler/${protocol}`], { timeout: 5000 });
        return found.stdout.trim() ? {} : undefined;
    } catch { return undefined; }
}

/**
 * Launches a validated custom protocol through its native app or registered OS handler.
 * @param url - Provider-serialized URL already checked against the declared scheme.
 * @param appPath - Optional validated macOS bundle path from native/test discovery.
 * @throws Sanitized launch failure without exposing callback credentials in command errors.
 */
export async function launchExternalApplication(url: string, appPath?: string): Promise<void> {
    try {
        if (process.platform === 'darwin' && appPath)
            await run('/usr/bin/open', ['-a', appPath, url], { timeout: 15000 });
        else await shell.openExternal(url);
    } catch {
        // Native errors may include the full command URL and its bearer token.
        throw new Error('External application launch failed.');
    }
}
