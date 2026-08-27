import type { DeveloperYouTubeStatus } from '../../Common/IPC';

/** Describes the cached developer you tube status contract. */
export interface CachedDeveloperYouTubeStatus {
  /** The value value. */
  readonly value: DeveloperYouTubeStatus;
  /** The expires at value. */
  readonly expiresAt: number;
}

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
