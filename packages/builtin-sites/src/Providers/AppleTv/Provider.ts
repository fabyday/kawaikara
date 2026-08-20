import {
  provider,
  type NewWindowPolicy,
  type SiteRequestDetails,
  type SiteRequestHeaders,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import {
  applyBrowserIdentityHeaders,
  createBrowserUserAgent,
  matchesUrlHost,
  webPopupPolicy,
} from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.apple-tv',
  address: { hosts: ['tv.apple.com'] },
  title: 'Apple TV+',
  shortcut: { defaultKey: 'Control+Alt+A' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 90, icon: 'https://tv.apple.com/favicon.ico' },
  permissions: ['navigation', 'network-interception'],
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
