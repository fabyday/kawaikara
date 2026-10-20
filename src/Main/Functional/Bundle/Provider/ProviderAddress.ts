import {
    normalizeAddressInput,
    type RegisteredProvider,
    type ResolvedSiteAddress,
} from './SiteRuntime';

/**
 * Resolves an address to the most specific registered Provider host.
 *
 * @param value - User address or kawaikara://open URL containing exactly one url parameter.
 * Input is trimmed and limited to 16,384 characters before parsing.
 * @param providers - Registrations whose declared address hosts are eligible matches.
 * @returns A Provider ID and normalized HTTPS URL, or undefined for malformed,
 * unsupported, credential-bearing, explicit non-default-port or unmatched addresses.
 * @remarks The longest matching host wins; subdomains must match at a dot boundary.
 * Parsing failure is an ordinary unresolved result, not an exception. This function
 * performs no navigation, network request or Provider activation.
 */
export function resolveProviderAddress(
    value: string,
    providers: Iterable<RegisteredProvider>,
): ResolvedSiteAddress | undefined {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 16_384) return undefined;

    let target: URL;
    try {
        const parsed = new URL(normalizeAddressInput(trimmed));
        if (parsed.protocol === 'kawaikara:') {
            if (
                parsed.hostname !== 'open' ||
                (parsed.pathname !== '' && parsed.pathname !== '/') ||
                parsed.searchParams.getAll('url').length !== 1
            ) {
                return undefined;
            }
            const nested = parsed.searchParams.get('url');
            if (!nested) return undefined;
            target = new URL(normalizeAddressInput(nested));
        } else {
            target = parsed;
        }
    } catch {
        return undefined;
    }

    if (
        target.protocol !== 'https:' ||
        target.username ||
        target.password ||
        target.port
    ) {
        return undefined;
    }
    const hostname = target.hostname.toLowerCase();
    const match = [...providers]
        .flatMap((registration) =>
            (registration.metadata.address?.hosts ?? []).map((host) => ({
                registration,
                host: host.toLowerCase(),
            })),
        )
        .filter(
            ({ host }) => hostname === host || hostname.endsWith(`.${host}`),
        )
        .sort((left, right) => right.host.length - left.host.length)[0];
    return match
        ? {
              /** The site ID value. */
              siteId: match.registration.metadata.id,
              /** The URL value. */
              url: target.href,
          }
        : undefined;
}
