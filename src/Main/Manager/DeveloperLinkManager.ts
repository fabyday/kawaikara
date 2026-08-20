import type {
  ApplicationLinkId,
  DeveloperYouTubeStatus,
} from '../../Common/IPC';
import { openInDefaultBrowser } from '../Functional/DefaultBrowser';

const APPLICATION_LINKS: Readonly<Record<ApplicationLinkId, string>> = {
  website: 'https://kawaikara.github.io/',
  github: 'https://github.com/fabyday/kawaikara',
  discord: 'https://discord.gg/JJs974BX45',
  developerYouTube: 'https://www.youtube.com/@molera1708/live',
};

const LIVE_STATUS_TTL_MS = 60_000;
const OFFLINE_STATUS_TTL_MS = 10_000;
const STATUS_ERROR_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 12_000;
const YOUTUBE_PAGE_HEADERS = {
  'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
};

interface CachedStatus {
  readonly value: DeveloperYouTubeStatus;
  readonly expiresAt: number;
}

/** Opens the fixed project links and resolves the developer channel live state. */
export class DeveloperLinkManager {
  private cachedStatus?: CachedStatus;
  private activeStatusRequest?: Promise<DeveloperYouTubeStatus>;

  async open(id: ApplicationLinkId): Promise<void> {
    await openInDefaultBrowser(APPLICATION_LINKS[id]);
  }

  async getDeveloperYouTubeStatus(): Promise<DeveloperYouTubeStatus> {
    if (this.cachedStatus && this.cachedStatus.expiresAt > Date.now()) {
      return this.cachedStatus.value;
    }
    if (this.activeStatusRequest) return this.activeStatusRequest;

    const request = this.fetchDeveloperYouTubeStatus();
    this.activeStatusRequest = request;
    try {
      const value = await request;
      const ttl = value.error
        ? STATUS_ERROR_TTL_MS
        : value.isLive
          ? LIVE_STATUS_TTL_MS
          : OFFLINE_STATUS_TTL_MS;
      this.cachedStatus = { value, expiresAt: Date.now() + ttl };
      return value;
    } finally {
      if (this.activeStatusRequest === request) {
        this.activeStatusRequest = undefined;
      }
    }
  }

  private async fetchDeveloperYouTubeStatus(): Promise<DeveloperYouTubeStatus> {
    try {
      const response = await fetch(APPLICATION_LINKS.developerYouTube, {
        headers: YOUTUBE_PAGE_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`YouTube live page failed: ${String(response.status)}`);
      }
      const html = await response.text();
      return this.createStatus(isYouTubeLivePage(html));
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      console.warn('Developer YouTube live status check failed.', error);
      return this.createStatus(false, error);
    }
  }

  private createStatus(
    isLive: boolean,
    error?: string,
  ): DeveloperYouTubeStatus {
    return {
      isLive,
      checkedAt: new Date().toISOString(),
      error,
    };
  }
}

function isYouTubeLivePage(html: string): boolean {
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
