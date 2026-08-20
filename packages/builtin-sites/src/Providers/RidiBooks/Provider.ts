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
  webPopupPolicy,
} from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.ridibooks',
  address: { hosts: ['ridibooks.com'] },
  title: 'RIDI',
  shortcut: { defaultKey: 'Control+Alt+R' },
  locale: BUILTIN_SITE_LOCALE,
  pictureInPicture: { enabled: false },
  menu: { category: 'Books', order: 10, icon: 'https://ridibooks.com/favicon.ico' },
  permissions: ['navigation', 'network-interception'],
})
export class RidiBooksProvider extends UrlProvider {
  protected readonly url = 'https://ridibooks.com/';
  private browserUserAgent?: string;

  protected async beforeLoad(): Promise<void> {
    this.browserUserAgent = createBrowserUserAgent(
      this.context.viewer.getUserAgent(),
    );
    this.context.viewer.setUserAgent(this.browserUserAgent);
  }

  onNewWindow(url: string): NewWindowPolicy {
    // RIDI's SNS providers (Apple, Google, Kakao, and Naver) use popup-based
    // OAuth. Keeping the popup in the Provider Session lets the resulting
    // login cookies become visible to the original RIDI viewer.
    return webPopupPolicy(url);
  }

  onBeforeSendHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    if (!this.browserUserAgent || !/^https?:\/\//i.test(details.url)) {
      return undefined;
    }
    // The first OAuth request may leave RIDI immediately, before the popup's
    // WebContents user agent is updated. Cover that initial request as well.
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
