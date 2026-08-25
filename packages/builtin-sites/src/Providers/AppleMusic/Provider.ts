import {
  provider,
  type NewWindowPolicy,
  type SiteRequestDetails,
  type SiteRequestHeaders,
} from '@kawaikara/site-api';
import {
  applyBrowserIdentityHeaders,
  createBrowserUserAgent,
  matchesUrlHost,
  webPopupPolicy,
} from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';

@provider()
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
