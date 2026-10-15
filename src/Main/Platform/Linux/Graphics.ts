/** Apply capture-compatible native video overlay settings. */
export function configureCaptureCompatibleGraphics(): void {}
/** Whether this target ships a native video backend. */
export function hasNativeVideoBackend(): boolean {
    return false;
}
/** Whether a retained video surface needs warming before activation. */
export function shouldPrewarmVideoSurface(): boolean {
    return false;
}
