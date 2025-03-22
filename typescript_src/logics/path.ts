import path from 'path';

/**
 *
 * @param pth platform dependant filesystem path literal.
 * @returns electron's filesystem path literal.
 */
export function cvrt_electron_path(pth: string) {
    if (process.platform === 'win32') {
        return pth;
    } else {
        // darwin, linux and so on.

        return `file://${pth}`;
    }
}
