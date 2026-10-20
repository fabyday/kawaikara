import type { DeveloperYouTubeStatus } from '../../../Common/IPC';

/** Determines whether the you tube live page condition applies. */
export function isYouTubeLivePage(html: string): boolean {
    if (/"isLiveNow"\s*:\s*true/.test(html)) return true;
    if (/"broadcastStatus"\s*:\s*"ACTIVE"/.test(html)) return true;

    const hasLiveContent = /"isLiveContent"\s*:\s*true/.test(html);
    const hasLiveBroadcastDetails = /"liveBroadcastDetails"\s*:/.test(html);
    const hasWatchEndpoint =
        /"watchEndpoint"\s*:/.test(html) || /watch\?v=/.test(html);
    const hasOfflineSignal =
        /"playabilityStatus"\s*:\s*\{[^}]*"status"\s*:\s*"LIVE_STREAM_OFFLINE"/.test(
            html,
        );
    const hasUpcomingSignal =
        /"isUpcoming"\s*:\s*true/.test(html) ||
        /"upcomingEventData"\s*:/.test(html);

    return (
        hasLiveContent &&
        hasLiveBroadcastDetails &&
        hasWatchEndpoint &&
        !hasOfflineSignal &&
        !hasUpcomingSignal
    );
}

/** Defines the shared live status ttl ms constant. */
const LIVE_STATUS_TTL_MS = 60_000;
/** Defines the shared offline status ttl ms constant. */
const OFFLINE_STATUS_TTL_MS = 10_000;
/** Defines the shared status error ttl ms constant. */
const STATUS_ERROR_TTL_MS = 30_000;
/** Defines the shared request timeout ms constant. */
const REQUEST_TIMEOUT_MS = 12_000;
/** Defines the shared YouTube page headers constant. */
const YOUTUBE_PAGE_HEADERS = {
    /** The accept language value. */
    'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    /** The user agent value. */
    'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
};

/** Fetches a channel's live page without retaining state between calls. */
export async function fetchYouTubeLiveStatus(
    url: string,
): Promise<DeveloperYouTubeStatus> {
    try {
        const response = await fetch(url, {
            headers: YOUTUBE_PAGE_HEADERS,
            redirect: 'follow',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
            throw new Error(`YouTube live page failed: ${String(response.status)}`);
        }
        return {
            /** Whether the live page contains active-broadcast metadata. */
            isLive: isYouTubeLivePage(await response.text()),
            /** Completion time of the remote lookup. */
            checkedAt: new Date().toISOString(),
        };
    } catch (reason) {
        const error = reason instanceof Error ? reason.message : String(reason);
        console.warn('YouTube live status check failed.', error);
        return {
            /** Failed lookups do not assert a live broadcast. */
            isLive: false,
            /** Time of the failed lookup. */
            checkedAt: new Date().toISOString(),
            /** Diagnostic information for the status indicator. */
            error,
        };
    }
}

/** Creates one channel lookup with shared in-flight requests and status-specific TTLs. */
export function createYouTubeLiveStatusLookup(
    url: string,
): () => Promise<DeveloperYouTubeStatus> {
    let cached: { value: DeveloperYouTubeStatus; expiresAt: number } | undefined;
    let pending: Promise<DeveloperYouTubeStatus> | undefined;
    return async () => {
        if (cached && cached.expiresAt > Date.now()) return cached.value;
        if (pending) return pending;
        const request = fetchYouTubeLiveStatus(url);
        pending = request;
        try {
            const value = await request;
            const ttl = value.error
                ? STATUS_ERROR_TTL_MS
                : value.isLive
                  ? LIVE_STATUS_TTL_MS
                  : OFFLINE_STATUS_TTL_MS;
            cached = { value, expiresAt: Date.now() + ttl };
            return value;
        } finally {
            if (pending === request) pending = undefined;
        }
    };
}
