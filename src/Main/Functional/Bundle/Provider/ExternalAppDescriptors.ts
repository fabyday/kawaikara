import type { ProviderMetadata } from '@kawaikara/site-api';

/**
 * Validates static distribution sources without fetching them or granting app permissions.
 * @param metadata Provider registration, including its declared external app identities.
 * @throws Undeclared identities, malformed maps, credentials or non-public URL schemes.
 */
export function validateExternalAppManifests(metadata: ProviderMetadata): void {
    const sources = metadata.externalAppManifests;
    if (sources === undefined) return;
    if (
        !sources ||
        typeof sources !== 'object' ||
        Array.isArray(sources) ||
        Object.keys(sources).length > 64
    )
        throw new Error('Invalid external app manifest declarations.');
    for (const [id, value] of Object.entries(sources)) {
        if (
            !metadata.externalApps?.includes(id) ||
            typeof value !== 'string' ||
            value.length > 4096
        )
            throw new Error('Undeclared external app manifest.');
        const url = new URL(value);
        if (
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            url.port
        )
            throw new Error('External app manifests require public HTTPS.');
    }
}
