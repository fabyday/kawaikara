import {
    type ProviderDownloadContext,
    type ProviderDownloadResult,
} from '@kawaikara/site-api';

/**
 * Requests the companion-owned open function through a resource-scoped host facade.
 * @param context - Desktop-supplied discovery and request facade.
 * @param appId - Application explicitly chosen by the calling Provider.
 * @returns Selected app identity and negotiation/handoff outcome, without navigating a viewer.
 * @throws Propagates transport failures so callers do not incorrectly show installation UI.
 */
export async function requestYouTubeDownloader(
    context: ProviderDownloadContext,
    appId: string,
): Promise<ProviderDownloadResult> {
    const app = await context.externalApps.find(appId);
    if (!app)
        return {
            /** Application selected by the Provider, including missing installations. */
            appId,
            /** Availability or dispatch outcome consumed by the caller. */
            result: {
                /** Whether the transport accepted this handoff. */
                accepted: false,
                /** Machine-readable reason the request was not dispatched. */
                code: 'unavailable',
                /** Whether installing or restoring the application can allow retry. */
                recoverable: true,
            },
        };
    return {
        /** Application selected by the Provider, including missing installations. */
        appId,
        /** Availability or dispatch outcome consumed by the caller. */
        result: await context.externalApps.request(appId, { action: 'open' }),
    };
}
