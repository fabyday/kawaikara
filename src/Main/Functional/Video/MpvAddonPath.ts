import { app } from 'electron';
import path from 'node:path';

/** Resolves the MPV addon path. */
export function resolveMpvAddonPath(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'mpv', 'mpv_addon.node');
    }
    return path.resolve(
        __dirname,
        '../../node_modules/electron-mpv-video/native/mpv-addon/build/Release/mpv_addon.node',
    );
}
