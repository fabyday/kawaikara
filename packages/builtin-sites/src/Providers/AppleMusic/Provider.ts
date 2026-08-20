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
  id: 'kawaikara.apple-music',
  address: { hosts: ['music.apple.com'] },
  title: 'Apple Music',
  shortcut: { defaultKey: 'Control+Alt+M' },
  locale: BUILTIN_SITE_LOCALE,
  pictureInPicture: { enabled: false },
  menu: { category: 'Music', order: 10, icon: 'https://music.apple.com/favicon.ico' },
  permissions: ['navigation', 'network-interception'],
})
export class AppleMusicProvider extends UrlProvider {
  protected readonly url = 'https://music.apple.com/';
  private browserUserAgent?: string;

  protected async beforeLoad(): Promise<void> {
    this.browserUserAgent = createBrowserUserAgent(
      this.context.viewer.getUserAgent(),
    );
    this.context.viewer.setUserAgent(this.browserUserAgent);
  }

  onNewWindow(url: string): NewWindowPolicy {
    // Apple Music and Apple TV share the Apple Account popup flow.
    return webPopupPolicy(url);
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
