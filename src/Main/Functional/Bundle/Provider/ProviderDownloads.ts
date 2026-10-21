import type { ExternalAppManager } from '../../../Manager/ExternalAppManager';
import type { ExternalAppCookie } from '../../ExternalApps/ExternalAppAdapter';
import type { ProviderDownloadResult } from '@kawaikara/site-api';
import { isExternalDownloaderSourceUrl } from '../../../../Common/Download';
import { resolveProviderAddress } from './ProviderAddress';
import type { RegisteredProvider } from './SiteRuntime';

/** Host-resolved installation source; Provider return values cannot override it. */
export interface ProviderDownloadDispatchResult extends ProviderDownloadResult {
    /** Manifest selected from the registered Provider descriptor. */
    readonly distributionUrl?: string;
}

/**
 * Authorizes a declared static download handler without activating the Provider.
 * @param registration - Current trusted registration; undefined rejects the request.
 * @param url - HTTPS source constrained to this registration's declared address hosts.
 * @param apps - Read/request facade for native applications; undefined rejects the request.
 * @param isRegistered - Rechecked before each app operation to revoke unloaded/replaced Bundles.
 * @param getPartition - Resolves the current selected Provider profile; changes revoke saved resource access.
 * @param readCookies - Injected native cookie reader; omission denies cookie requests.
 * @returns The Provider's selected application and handoff outcome.
 * @throws Missing authority, mismatched sources, retired registrations and handler failures.
 */
export async function dispatchProviderDownload(
    registration: RegisteredProvider | undefined,
    url: string,
    apps: ExternalAppManager | undefined,
    isRegistered: () => boolean,
    getPartition: () => string,
    readCookies?: (
        partition: string,
        url: string,
    ) => Promise<readonly ExternalAppCookie[]>,
): Promise<ProviderDownloadDispatchResult> {
    const address =
        registration && isExternalDownloaderSourceUrl(url)
            ? resolveProviderAddress(url, [registration])
            : undefined;
    const declared =
        registration?.metadata.permissions?.includes('web-extension') &&
        Object.values(
            registration.metadata.webExtension?.actionDefinitions ?? {},
        ).some((definition) => definition.handler === 'download');
    if (!declared || !address || !registration?.constructor.onDownload || !apps)
        throw new Error('Provider download action is unavailable.');
    /** Saved callbacks cannot dispatch through an unloaded/replaced registration. */
    const requireRegistered = () => {
        if (!isRegistered())
            throw new Error('Provider download context is no longer active.');
    };
    requireRegistered();
    const partition = getPartition();
    const scopedApps = apps.forResource({
        provider: { id: registration.metadata.id, name: registration.metadata.title },
        url: address.url,
        isActive: () => isRegistered() && getPartition() === partition,
        readCookies: () =>
            readCookies
                ? readCookies(partition, address.url)
                : Promise.reject(
                      new Error('Cookie resource host unavailable.'),
                  ),
    });
    const outcome = await registration.constructor.onDownload(address.url, {
        /** Registration-scoped discovery and dispatch without installer authority. */
        externalApps: {
            /** Discovery is scoped to the originating registration. */
            find: async (id) => {
                requireRegistered();
                if (!registration.metadata.externalApps?.includes(id)) throw new Error('Undeclared external app.');
                const info = await scopedApps.find(id);
                requireRegistered();
                return info;
            },
            /** Launch authority is checked again after asynchronous Provider work. */
            request: (id, request) => {
                requireRegistered();
                if (!registration.metadata.externalApps?.includes(id)) throw new Error('Undeclared external app.');
                return scopedApps.request(id, request);
            },
        },
    });
    requireRegistered();
    if (!registration.metadata.externalApps?.includes(outcome.appId))
        throw new Error('Undeclared external app result.');
    return {
        ...outcome,
        /** Only manifest-owned sources may select installation metadata. */
        distributionUrl: registration.metadata.externalAppManifests?.[outcome.appId],
    };
}
