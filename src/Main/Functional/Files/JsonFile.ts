import { readFileBytes, type FileReadOptions } from './FileRead';

/**
 * Reads JSON without trusting its shape or suppressing filesystem/parse failures.
 * @param filePath App-owned or feature-validated path.
 * @param options Optional read budget and final-component symlink policy.
 * @returns Unknown data; the owning manifest, log or settings validator must validate the schema.
 */
export async function readJsonFile(
    filePath: string,
    options?: FileReadOptions,
): Promise<unknown> {
    return JSON.parse(
        (await readFileBytes(filePath, options)).toString('utf8'),
    ) as unknown;
}
