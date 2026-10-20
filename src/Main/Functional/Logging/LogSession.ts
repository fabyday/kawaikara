import { KAWAIKARA_SITE_API_VERSION } from '@kawaikara/site-api';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ApplicationLogMetadata } from '../../../Common/IPC';
import { APPLICATION_LOG_SOURCES } from '../../../Common/Logging';
import { getOperatingSystemLabel } from '../../Platform/Information';
import { getKawaiDataPath } from '../App/UserDataPaths';

import { LOG_DEVICE_ID_FILE_NAME } from './LogConstants';
import { isRecord } from './LogParsing';

/** Returns the persistent human-readable installation identity for logs. */
export function getOrCreateLogDeviceId(): string {
    const identityPath = getKawaiDataPath(LOG_DEVICE_ID_FILE_NAME);
    try {
        const parsed: unknown = JSON.parse(readFileSync(identityPath, 'utf8'));
        if (
            isRecord(parsed) &&
            parsed.schemaVersion === 1 &&
            typeof parsed.deviceId === 'string' &&
            /^KAWA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(parsed.deviceId)
        ) {
            return parsed.deviceId;
        }
    } catch {
        // A missing or invalid app-owned identity is safely replaced below.
    }
    const compactId = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const deviceId = `KAWA-${compactId.slice(0, 4)}-${compactId.slice(4)}`;
    mkdirSync(path.dirname(identityPath), { recursive: true });
    writeFileSync(
        identityPath,
        JSON.stringify(
            {
                /** The identity schema version value. */
                schemaVersion: 1,
                /** The readable installation ID value. */
                deviceId,
                /** The identity creation timestamp value. */
                createdAt: new Date().toISOString(),
            },
            null,
            2,
        ),
        { encoding: 'utf8', mode: 0o600 },
    );
    return deviceId;
}

/** Creates a unique session file name without merging two rapid restarts. */
export function createAvailableLogFileName(date: Date): string {
    const directory = getKawaiDataPath('logs');
    const dateStem = formatLogFileDate(date);
    for (let index = 0; index < 10_000; index += 1) {
        const candidate = `${dateStem}-${String(index)}.log`;
        if (!existsSync(path.join(directory, candidate))) return candidate;
    }
    return `${dateStem}-${randomUUID()}.log`;
}

/** Formats the local date portion of a session log file name. */
function formatLogFileDate(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Creates the trusted metadata written before the first log entry. */
export function createLogMetadata(
    sessionId: string,
    deviceId: string,
): ApplicationLogMetadata {
    return {
        /** The metadata schema version value. */
        schemaVersion: 1,
        /** The session ID value. */
        sessionId,
        /** The application name value. */
        applicationName: app.getName(),
        /** The application version value. */
        version: app.getVersion(),
        /** The release channel value. */
        channel: __KAWAIKARA_BUILD_CHANNEL__,
        /** The operating system label value. */
        platform: getOperatingSystemLabel(),
        /** The processor architecture value. */
        arch: process.arch,
        /** The Site API version value. */
        siteApiVersion: KAWAIKARA_SITE_API_VERSION,
        /** The session creation timestamp value. */
        createdAt: new Date().toISOString(),
        /** The readable installation ID value. */
        deviceId,
        /** The runtime version values. */
        runtime: {
            /** The Electron runtime version value. */
            electron: process.versions.electron,
            /** The Chrome runtime version value. */
            chrome: process.versions.chrome,
            /** The Node.js runtime version value. */
            node: process.versions.node,
            /** The V8 runtime version value. */
            v8: process.versions.v8,
        },
        /** The registered log source values. */
        sources: Object.values(APPLICATION_LOG_SOURCES),
    };
}
