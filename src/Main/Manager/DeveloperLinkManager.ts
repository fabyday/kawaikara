import type {
  ApplicationLinkId,
  DeveloperYouTubeStatus,
} from '../../Common/IPC';
import { openInDefaultBrowser } from '../Functional/DefaultBrowser';
import {
  isYouTubeLivePage,
  type CachedDeveloperYouTubeStatus,
} from '../Functional/DeveloperLinks';

/** Defines the shared application links constant. */
const APPLICATION_LINKS: Readonly<Record<ApplicationLinkId, string>> = {
  /** The website value. */
  website: 'https://kawaikara.github.io/',
  /** The github value. */
  github: 'https://github.com/fabyday/kawaikara',
  /** The discord value. */
  discord: 'https://discord.gg/JJs974BX45',
  /** The developer you tube value. */
  developerYouTube: 'https://www.youtube.com/@molera1708/live',
};

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

/** Opens the fixed project links and resolves the developer channel live state. */
export class DeveloperLinkManager {
  /** The cached status value. */
  private cachedStatus?: CachedDeveloperYouTubeStatus;
  /** Whether the active status request option is enabled. */
  private activeStatusRequest?: Promise<DeveloperYouTubeStatus>;

  /** Opens the operation. */
  async open(id: ApplicationLinkId): Promise<void> {
    await openInDefaultBrowser(APPLICATION_LINKS[id]);
  }

  /** Returns the developer you tube status. */
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
      this.cachedStatus = { value, expiresAt: Date.now() + ttl
      };
      return value;
    } finally {
      if (this.activeStatusRequest === request) {
        this.activeStatusRequest = undefined;
      }
    }
  }

  /** Performs the fetch developer you tube status operation. */
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

  /** Creates the status. */
  private createStatus(
    isLive: boolean,
    error?: string,
  ): DeveloperYouTubeStatus {
    return {
      /** Whether the live option is enabled. */
      isLive,
      /** The checked at value. */
      checkedAt: new Date().toISOString(),
      /** The error value. */
      error,
    };
  }
}
