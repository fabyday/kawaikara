/** Return the operating system's user-facing release label. */
export function getOperatingSystemLabel(): string {
    return `Linux ${process.getSystemVersion()}`;
}
