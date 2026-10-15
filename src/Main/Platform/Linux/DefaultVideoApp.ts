/** Default-video-app registration is not implemented on this OS. */
export function canConfigureDefaultVideoApp(): boolean {
    return false;
}
/** Reject unavailable settings without opening another application. */
export async function openDefaultVideoAppSettings(): Promise<void> {
    throw new Error('An installed Windows build is required.');
}
/** Omit the settings capability on unsupported desktops. */
export function getDefaultVideoAppCapability(): boolean | undefined {
    return undefined;
}
