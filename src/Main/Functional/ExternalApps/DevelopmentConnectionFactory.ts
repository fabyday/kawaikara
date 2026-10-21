import path from 'node:path';
import { nativeImage } from 'electron';
import { KAWAI_DOWNLOADER_APP_ID } from '../../../Common/Download';
import { DevelopmentConnection } from './DevelopmentConnection';
import { ExternalAppIconCache } from './ExternalAppIconCache';

/**
 * Creates the test-only transport and isolates its grants, binding state and icons.
 * @param dataDirectory Host profile directory; no installed connection state is reused.
 * @returns Unstarted development transport. The caller owns startup and disposal.
 * @remarks Imported only inside the external-app testing compile-time branch.
 */
export function createDevelopmentConnection(dataDirectory: string): DevelopmentConnection {
    return new DevelopmentConnection(
        path.join(dataDirectory, 'external-app-development-connections.json'),
        [KAWAI_DOWNLOADER_APP_ID],
        undefined,
        new ExternalAppIconCache(
            path.join(dataDirectory, 'external-app-icons-development.json'),
            bytes => {
                const image = nativeImage.createFromBuffer(bytes);
                if (image.isEmpty()) throw new Error('Invalid app icon pixels.');
                return image.resize({ width: 64, height: 64 }).toPNG();
            },
        ),
    );
}
