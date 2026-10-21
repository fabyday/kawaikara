/** Linux downloads are saved as non-executable files and are never launched automatically. */
export async function markDownloadedFile(
    _file: string,
    _source: string,
): Promise<void> {}
