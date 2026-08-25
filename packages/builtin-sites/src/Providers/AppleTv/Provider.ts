import {
  provider,
  type NewWindowPolicy,
  type SiteRequestDetails,
  type SiteRequestHeaders,
} from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import {
  applyBrowserIdentityHeaders,
  createBrowserUserAgent,
  matchesUrlHost,
  webPopupPolicy,
} from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture([
    '[class*="apple-web-player" i] [class*="caption" i]',
  ]),
})
export class AppleTvProvider extends UrlProvider {
  protected readonly url = 'https://tv.apple.com/';
  private browserUserAgent?: string;

  onNewWindow(url: string): NewWindowPolicy {
    // Apple Account authentication is intentionally hosted in a popup.
    return webPopupPolicy(url);
  }

  protected async beforeLoad(): Promise<void> {
    this.browserUserAgent = createBrowserUserAgent(
      this.context.viewer.getUserAgent(),
    );
    this.context.viewer.setUserAgent(this.browserUserAgent);
  }

  protected async afterLoad(): Promise<void> {
    // Apple storefronts select a regional catalog, not merely the display
    // language. Persist an explicit choice made in Apple's region UI and use
    // the geo cookie only as a non-persistent fallback before the user chooses.
    await this.context.viewer.executeJavaScript(
      APPLE_STOREFRONT_PERSISTENCE_SCRIPT,
    );
  }

  onBeforeSendHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    if (
      !this.browserUserAgent ||
      !matchesUrlHost(details.url, ['apple.com'])
    ) {
      return undefined;
    }
    return applyBrowserIdentityHeaders(
      details.requestHeaders,
      this.browserUserAgent,
    );
  }

  async unload(): Promise<void> {
    this.browserUserAgent = undefined;
    this.context.viewer.setUserAgent();
    await super.unload();
  }
}

const APPLE_STOREFRONT_PERSISTENCE_SCRIPT = `
  (() => {
    if (location.hostname !== 'tv.apple.com') {
      return { status: 'unchanged' };
    }
    const storageKey = 'kawaikara.apple-tv.storefront.v1';
    const automaticStorefrontKey =
      'kawaikara.apple-tv.automatic-storefront.v1';
    const normalizeStorefront = (value) =>
      typeof value === 'string' && /^[a-z]{2}$/i.test(value)
        ? value.toLowerCase()
        : '';
    const readStoredStorefront = () => {
      try {
        return normalizeStorefront(localStorage.getItem(storageKey));
      } catch {
        return '';
      }
    };
    const writeStoredStorefront = (storefront) => {
      try {
        localStorage.setItem(storageKey, storefront);
      } catch {}
    };
    const routeStorefront = normalizeStorefront(
      /^\\/([a-z]{2})(?:\\/|$)/i.exec(location.pathname)?.[1],
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

    if (!window.__kawaikaraAppleStorefrontPersistence) {
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest('a[href]');
        if (!link) return;
        try {
          const url = new URL(link.href, location.href);
          if (url.hostname !== 'tv.apple.com') return;
          const selectedStorefront = normalizeStorefront(
            /^\\/([a-z]{2})\\/?$/i.exec(url.pathname)?.[1],
          );
          if (selectedStorefront) {
            writeStoredStorefront(selectedStorefront);
          }
        } catch {}
      }, true);
      window.__kawaikaraAppleStorefrontPersistence = true;
    }

    if (location.pathname !== '/') {
      return {
        status: routeStorefront ? 'stored' : 'unchanged',
        storefront: routeStorefront || undefined,
      };
    }
    const geoStorefront = normalizeStorefront(
      /(?:^|;\\s*)geo=([a-z]{2})(?:;|$)/i.exec(document.cookie)?.[1],
    );
    const storefront = readStoredStorefront() || geoStorefront;
    if (!storefront || storefront === 'us') {
      return { status: 'unchanged', storefront: storefront || undefined };
    }
    if (window.__kawaikaraAppleStorefrontRedirect === storefront) {
      return { status: 'pending', storefront };
    }
    window.__kawaikaraAppleStorefrontRedirect = storefront;
    try {
      sessionStorage.setItem(automaticStorefrontKey, storefront);
    } catch {}
    location.replace(
      'https://tv.apple.com/' + storefront + location.search + location.hash,
    );
    return { status: 'redirected', storefront };
  })();
`;
