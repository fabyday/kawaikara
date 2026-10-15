import { app } from 'electron';
/** Apply capture-compatible native video overlay settings. */
export function configureCaptureCompatibleGraphics(): void {
    const features = new Set(
        app.commandLine
            .getSwitchValue('disable-features')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
    );
    features.add('avfoundation-overlays');
    app.commandLine.removeSwitch('disable-features');
    app.commandLine.appendSwitch('disable-features', [...features].join(','));
}
/** Whether this target ships a native video backend. */
export function hasNativeVideoBackend(): boolean {
    return process.arch === 'arm64';
}
/** Whether a retained video surface needs warming before activation. */
export function shouldPrewarmVideoSurface(): boolean {
    return false;
}
