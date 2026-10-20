import type { ProviderManager } from '../../Manager/ProviderManager';
import type { ViewerRuntime } from '../Viewer/ViewerRuntime';
import { isExternalDownloaderSourceUrl } from '../../../Common/Download';
import { YOUTUBE_DOWNLOADER_APP_ID } from './YouTubeDownloaderAdapter';

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
    sites: Pick<ProviderManager, 'requestDownload' | 'load'>,
    viewer: Pick<ViewerRuntime, 'video' | 'viewer'>,
    providerId: string,
    url: string,
    focusSetup = false,
) {
    if (!isExternalDownloaderSourceUrl(url))
        throw new TypeError('A safe HTTPS source URL is required.');
    const { appId, result } = await sites.requestDownload(providerId, url);
    if (result.accepted) return result;
    if (result.code !== 'unavailable' || appId !== YOUTUBE_DOWNLOADER_APP_ID)
        throw new Error(`External application request failed: ${result.code}`);
    viewer.video.queueYouTubeDownloader(url);
    viewer.viewer.hideOverlay();
    await sites.load('kawaikara.video');
    if (focusSetup) viewer.viewer.focusViewer();
    return result;
}
