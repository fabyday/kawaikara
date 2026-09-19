import type {
  SiteMenuItem
} from '../../../../Common/IPC';

/** Formats the address for display. */
export function formatAddressForDisplay(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return value;
    const hostname = url.hostname.replace(/^www\./i, '');
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${hostname}${url.port ? `:${url.port}` : ''}${path}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

/** Describes the address suggestion contract. */
export interface AddressSuggestion {
  /** The host value. */
  readonly host: string;
  /** The site value. */
  readonly site: SiteMenuItem;
}

/** Creates the address suggestions. */
export function createAddressSuggestions(
  sites: readonly SiteMenuItem[],
  value: string,
): AddressSuggestion[] {
  const query = normalizeAddressSuggestionQuery(value);
  const seenHosts = new Set<string>();
  return sites
    .flatMap((site) => site.addressHosts.map((host) => ({
      host: host.toLowerCase(),
      site,
    })))
    .filter(({ host, site }) => {
      if (seenHosts.has(host)) return false;
      if (
        query &&
        !host.includes(query) &&
        !site.title.toLowerCase().includes(query)
      ) {
        return false;
      }
      seenHosts.add(host);
      return true;
    })
    .sort((left, right) => {
      const leftScore = addressSuggestionScore(left, query);
      const rightScore = addressSuggestionScore(right, query);
      return leftScore - rightScore || left.site.title.localeCompare(right.site.title);
    })
    .slice(0, 8);
}

/** Normalizes the address suggestion query. */
export function normalizeAddressSuggestionQuery(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  try {
    const parsed = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (parsed.protocol === 'kawaikara:') {
      const nested = parsed.searchParams.get('url');
      return nested ? normalizeAddressSuggestionQuery(nested) : '';
    }
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return trimmed
      .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
      .replace(/^www\./, '')
      .split(/[/?#]/, 1)[0] ?? '';
  }
}

/** Performs the address suggestion score operation. */
export function addressSuggestionScore(
  suggestion: AddressSuggestion,
  query: string,
): number {
  if (!query) return 4;
  if (suggestion.host === query) return 0;
  if (suggestion.host.startsWith(query)) return 1;
  if (suggestion.site.title.toLowerCase().startsWith(query)) return 2;
  return 3;
}
