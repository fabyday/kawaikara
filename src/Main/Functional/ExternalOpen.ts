export const KAWAIKARA_PROTOCOL = 'kawaikara';

const MAX_DEEP_LINK_LENGTH = 16_384;
const MAX_TARGET_URL_LENGTH = 8_192;

interface SupportedSiteRule {
  readonly id: string;
  readonly domains: readonly string[];
}

const SUPPORTED_SITE_RULES: readonly SupportedSiteRule[] = [
  { id: 'kawaikara.youtube-music', domains: ['music.youtube.com'] },
  { id: 'kawaikara.apple-music', domains: ['music.apple.com'] },
  { id: 'kawaikara.apple-tv', domains: ['tv.apple.com'] },
  { id: 'kawaikara.chzzk', domains: ['chzzk.naver.com'] },
  { id: 'kawaikara.spotify', domains: ['open.spotify.com'] },
  { id: 'kawaikara.youtube', domains: ['youtube.com', 'youtu.be'] },
  { id: 'kawaikara.netflix', domains: ['netflix.com'] },
  { id: 'kawaikara.laftel', domains: ['laftel.net'] },
  { id: 'kawaikara.disneyplus', domains: ['disneyplus.com'] },
  { id: 'kawaikara.amazon-prime-video', domains: ['primevideo.com'] },
  { id: 'kawaikara.wavve', domains: ['wavve.com'] },
  { id: 'kawaikara.watcha', domains: ['watcha.com'] },
  { id: 'kawaikara.coupang-play', domains: ['coupangplay.com'] },
  { id: 'kawaikara.tving', domains: ['tving.com'] },
  { id: 'kawaikara.crunchyroll', domains: ['crunchyroll.com'] },
  { id: 'kawaikara.twitch', domains: ['twitch.tv'] },
  { id: 'kawaikara.ridibooks', domains: ['ridibooks.com'] },
] as const;

export interface ExternalOpenRequest {
  readonly siteId: string;
  readonly targetUrl: string;
}

export function parseExternalOpenUrl(
  value: string,
): ExternalOpenRequest | undefined {
  if (!value || value.length > MAX_DEEP_LINK_LENGTH) {
    return undefined;
  }

  try {
    const deepLink = new URL(value);
    if (
      deepLink.protocol !== `${KAWAIKARA_PROTOCOL}:` ||
      deepLink.hostname !== 'open' ||
      (deepLink.pathname !== '' && deepLink.pathname !== '/') ||
      deepLink.username ||
      deepLink.password ||
      deepLink.port ||
      deepLink.searchParams.getAll('url').length !== 1
    ) {
      return undefined;
    }

    const targetValue = deepLink.searchParams.get('url');
    if (!targetValue || targetValue.length > MAX_TARGET_URL_LENGTH) {
      return undefined;
    }

    const target = new URL(targetValue);
    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password ||
      target.port
    ) {
      return undefined;
    }

    const siteId = resolveSupportedSiteId(target.hostname);
    return siteId ? { siteId, targetUrl: target.href } : undefined;
  } catch {
    return undefined;
  }
}

export function parseExternalOpenArguments(
  args: readonly string[],
): ExternalOpenRequest[] {
  return args.flatMap((value) => {
    const request = parseExternalOpenUrl(value);
    return request ? [request] : [];
  });
}

function resolveSupportedSiteId(hostname: string): string | undefined {
  const normalizedHostname = hostname.toLowerCase();
  return SUPPORTED_SITE_RULES.find(({ domains }) =>
    domains.some(
      (domain) =>
        normalizedHostname === domain ||
        normalizedHostname.endsWith(`.${domain}`),
    ),
  )?.id;
}

