import { serializePageInjection } from '@kawaikara/site-api';

/**
 * Apple TV page-world storefront persistence. AppleTvProvider.beforeLoad() in
 * Providers/AppleTv/Provider.ts registers the serialized factory with
 * SitePagePipeline, which reruns it on DOM-ready and did-finish-load. No other
 * Provider consumes this injection.
 */
function persistAppleTvStorefront(): {
  /** The status value. */
  readonly status: 'unchanged' | 'stored' | 'pending' | 'redirected';
  /** The storefront value. */
  readonly storefront?: string;
} {
  /** Describes the apple storefront global contract. */
  interface AppleStorefrontGlobal extends Window {
    /** Whether the Kawaikara apple storefront persistence option is enabled. */
    __kawaikaraAppleStorefrontPersistence?: boolean;
    /** The Kawaikara apple storefront redirect value. */
    __kawaikaraAppleStorefrontRedirect?: string;
  }

  if (location.hostname !== 'tv.apple.com') return {
    /** The status value. */
    status: 'unchanged',
  };

  const pageWindow = window as AppleStorefrontGlobal;
  const storageKey = 'kawaikara.apple-tv.storefront.v1';
  const automaticStorefrontKey = 'kawaikara.apple-tv.automatic-storefront.v1';
  /** Normalizes the storefront. */
  const normalizeStorefront = (value: string | null | undefined): string =>
    typeof value === 'string' && /^[a-z]{2}$/i.test(value)
      ? value.toLowerCase()
      : '';
  /** Reads the stored storefront. */
  const readStoredStorefront = (): string => {
    try {
      return normalizeStorefront(localStorage.getItem(storageKey));
    } catch {
      return '';
    }
  };
  /** Performs the write stored storefront operation. */
  const writeStoredStorefront = (storefront: string): void => {
    try {
      localStorage.setItem(storageKey, storefront);
    } catch {}
  };

  const routeStorefront = normalizeStorefront(
    /^\/([a-z]{2})(?:\/|$)/i.exec(location.pathname)?.[1],
  );
  if (routeStorefront) {
    let automaticStorefront = '';
    try {
      automaticStorefront = normalizeStorefront(
        sessionStorage.getItem(automaticStorefrontKey),
      );
    } catch {}
    if (routeStorefront !== automaticStorefront) {
      writeStoredStorefront(routeStorefront);
      try {
        sessionStorage.removeItem(automaticStorefrontKey);
      } catch {}
    }
  }

  if (!pageWindow.__kawaikaraAppleStorefrontPersistence) {
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link) return;
      try {
        const url = new URL(link.href, location.href);
        if (url.hostname !== 'tv.apple.com') return;
        const selectedStorefront = normalizeStorefront(
          /^\/([a-z]{2})\/?$/i.exec(url.pathname)?.[1],
        );
        if (selectedStorefront) writeStoredStorefront(selectedStorefront);
      } catch {}
    }, true);
    pageWindow.__kawaikaraAppleStorefrontPersistence = true;
  }

  if (location.pathname !== '/') {
    return {
      /** The status value. */
      status: routeStorefront ? 'stored' : 'unchanged',
      /** The storefront value. */
      storefront: routeStorefront || undefined,
    };
  }
  const geoStorefront = normalizeStorefront(
    /(?:^|;\s*)geo=([a-z]{2})(?:;|$)/i.exec(document.cookie)?.[1],
  );
  const storefront = readStoredStorefront() || geoStorefront;
  if (!storefront || storefront === 'us') {
    return {
      /** The status value. */
      status: 'unchanged',
      /** The storefront value. */
      storefront: storefront || undefined,
    };
  }
  if (pageWindow.__kawaikaraAppleStorefrontRedirect === storefront) {
    return {
      /** The status value. */
      status: 'pending',
      /** The storefront value. */
      storefront,
    };
  }
  pageWindow.__kawaikaraAppleStorefrontRedirect = storefront;
  try {
    sessionStorage.setItem(automaticStorefrontKey, storefront);
  } catch {}
  location.replace(
    `https://tv.apple.com/${storefront}${location.search}${location.hash}`,
  );
  return {
    /** The status value. */
    status: 'redirected',
    /** The storefront value. */
    storefront,
  };
}

/** Creates the apple storefront persistence script. */
export function createAppleStorefrontPersistenceScript(): string {
  return serializePageInjection(persistAppleTvStorefront);
}
