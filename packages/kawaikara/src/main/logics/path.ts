import path from 'path';
import { pathToFileURL } from 'url';

/**
 *
 * @param pth platform dependant filesystem path literal.
 * @returns electron's filesystem path literal.
 */
export function cvrt_electron_path(pth: string) {
    return pathToFileURL(path.resolve(pth)).toString();
}
