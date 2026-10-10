import { app } from 'electron';

/** Disable video overlays that bypass capture, preserving Chromium's GPU safety policy. */
export function configureCaptureCompatibleGraphics(): void {
    if (process.platform === 'darwin') {
        const features = new Set(
            app.commandLine
                .getSwitchValue('disable-features')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
        );
        features.add('avfoundation-overlays');
        app.commandLine.removeSwitch('disable-features');
        app.commandLine.appendSwitch(
            'disable-features',
            [...features].join(','),
        );
    } else if (process.platform === 'win32') {
        app.commandLine.appendSwitch(
            'disable_direct_composition_video_overlays',
            '1',
        );
    }
}

/** Whether this build target has a shipped native video backend. */
export function hasNativeVideoBackend(): boolean {
    return (
        (process.platform === 'win32' && process.arch === 'x64') ||
        (process.platform === 'darwin' && process.arch === 'arm64')
    );
}

/** Whether the retained video surface needs warming before its first activation. */
export function shouldPrewarmVideoSurface(): boolean {
    return process.platform === 'win32';
}
