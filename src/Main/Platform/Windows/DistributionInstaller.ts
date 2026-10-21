import { writeFile } from 'node:fs/promises';

/** Marks a downloaded file as internet-origin so Windows retains its normal launch checks. */
export async function markDownloadedFile(
    file: string,
    source: string,
): Promise<void> {
    await writeFile(
        `${file}:Zone.Identifier`,
        `[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=${source}\r\n`,
    );
}
