import type { ProviderManager } from '../../Manager/ProviderManager';
import type { ViewerRuntime } from '../Viewer/ViewerRuntime';
import { isExternalAppSourceUrl } from '../../../Common/ExternalAppResources';

/**
 * Connects Provider-owned download selection to the existing companion setup view.
 * @param sites - Provider download dispatch and internal-view navigation.
 * @param viewer - Presentation owners; no window is changed on successful handoff.
 * @param providerId - Provider selected by the trusted caller/browser declaration.
 * @param url - HTTPS source, further constrained to the Provider by the dispatcher.
 * @param focusSetup - Whether a browser-originated missing-app request should foreground setup.
 * @returns The selected application's acceptance result.
 * @throws Invalid sources, unsupported requests and launch failures; none opens setup.
 */
export async function openProviderDownload(
    sites: Pick<
        ProviderManager,
        'requestDownload' | 'load' | 'getActiveProviderId'
    >,
    viewer: Pick<ViewerRuntime, 'viewer'>,
    providerId: string,
    url: string,
    focusSetup = false,
) {
    if (!isExternalAppSourceUrl(url))
        throw new TypeError('A safe HTTPS source URL is required.');
    const { appId, result, distributionUrl } = await sites.requestDownload(providerId, url);
    if (result.accepted || result.code === 'permission-denied') return result;
    if (result.code !== 'unavailable')
        throw new Error(`External application request failed: ${result.code}`);
    // Keep an already active Provider and its current playback/navigation intact.
    // Browser-originated requests may need to activate their Provider first.
    if (sites.getActiveProviderId() !== providerId)
        await sites.load(providerId);
    viewer.viewer.showExternalAppOverlay({ appId, providerId, sourceUrl: url, distributionUrl });
    if (focusSetup) viewer.viewer.focusViewer();
    return result;
}
