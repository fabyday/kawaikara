/** Operating systems supported by Kawaikara's native integration layer. */
export type SupportedPlatform = 'darwin' | 'win32' | 'linux';

/** Select an implementation without exposing OS dispatch to application callers. */
export function selectPlatform<T>(
    implementations: Record<SupportedPlatform, T>,
): T {
    switch (process.platform) {
        case 'darwin':
            return implementations.darwin;
        case 'win32':
            return implementations.win32;
        case 'linux':
            return implementations.linux;
        default:
            throw new Error(
                `Unsupported operating system: ${process.platform}`,
            );
    }
}
