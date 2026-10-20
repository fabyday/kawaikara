import type { IpcMainInvokeEvent } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** A remote Provider or subframe must never redirect the application's data root. */
export function requireSettingsSender(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame;
    const expected = path.resolve(__dirname, '../renderer/index.html');
    if (
        !frame ||
        frame !== event.sender.mainFrame ||
        !frame.url.startsWith('file:') ||
        path.resolve(fileURLToPath(frame.url)) !== expected
    )
        throw new Error(
            'Only the application settings UI may change data location.',
        );
}
