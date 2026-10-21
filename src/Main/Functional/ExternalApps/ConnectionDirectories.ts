import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Resolves separate per-user rendezvous namespaces without creating directories.
 * @param testing Selects development peers rather than the reserved installed-app namespace.
 * @returns Absolute discovery directory; durable grants stay in each app's data directory.
 * @throws If a Stable build attempts to select the test namespace.
 * @remarks The installed namespace is reserved for the shared-file protocol; returning
 * its path does not enable generic installed-app discovery or create a registration.
 */
export function externalAppConnectionDirectory(testing = false): string {
    const paths = process.platform === 'win32' ? path.win32 : path.posix;
    if (testing) {
        if (__KAWAIKARA_EXTERNAL_APP_TESTING__) {
            const directory = process.env.KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY
                ?? __KAWAIKARA_EXTERNAL_APP_TEST_DIRECTORY__;
            if (!directory || !paths.isAbsolute(directory))
                throw new Error('External app test directory must be absolute.');
            return paths.normalize(directory);
        }
        throw new Error('External app test directory is unavailable.');
    }
    if (process.platform === 'win32') {
        const local = process.env.LOCALAPPDATA;
        return paths.join(local && paths.isAbsolute(local) ? local : paths.join(homedir(), 'AppData', 'Local'), 'Kawaikara', 'connections', 'v1');
    }
    if (process.platform === 'darwin')
        return paths.join(homedir(), 'Library', 'Application Support', 'Kawaikara', 'connections', 'v1');
    const state = process.env.XDG_STATE_HOME;
    return paths.join(state && paths.isAbsolute(state) ? state : paths.join(homedir(), '.local', 'state'), 'kawaikara', 'connections', 'v1');
}
