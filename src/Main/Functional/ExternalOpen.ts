/** Defines the shared Kawaikara protocol constant. */
export const KAWAIKARA_PROTOCOL = 'kawaikara';

/** Defines the shared max deep link length constant. */
const MAX_DEEP_LINK_LENGTH = 16_384;
/** Defines the shared max target URL length constant. */
const MAX_TARGET_URL_LENGTH = 8_192;

/** Describes the external open request contract. */
export interface ExternalOpenRequest {
  /** The target URL value. */
  readonly targetUrl: string;
}

/** Parses the external open URL. */
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

    // Provider availability is intentionally resolved after Bundle discovery.
    // ExternalOpen is used before Electron is ready, when installed and
    // development Bundle manifests have not been loaded yet. SiteManager later
    // matches this URL against each live Provider's contributes.address.hosts.
    return {
      /** The target URL value. */
      targetUrl: target.href,
    };
  } catch {
    return undefined;
  }
}

/** Parses the external open arguments. */
export function parseExternalOpenArguments(
  args: readonly string[],
): ExternalOpenRequest[] {
  return args.flatMap((value) => {
    const request = parseExternalOpenUrl(value);
    return request ? [request] : [];
  });
}
