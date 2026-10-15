import { app } from 'electron';
/** Apply capture-compatible native video overlay settings. */
export function configureCaptureCompatibleGraphics(): void {
    app.commandLine.appendSwitch(
        'disable_direct_composition_video_overlays',
        '1',
    );
}
/** Whether this target ships a native video backend. */
export function hasNativeVideoBackend(): boolean {
    return process.arch === 'x64';
}
/** Whether a retained video surface needs warming before activation. */
export function shouldPrewarmVideoSurface(): boolean {
    return true;
}
