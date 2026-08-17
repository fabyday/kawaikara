import {
  site,
  type NewWindowPolicy,
  type SiteRequestDetails,
  type SiteRequestHeaders,
} from '@kawaikara/site-api';
import { LAFTEL_ICON } from '../Icons';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { createBrowserUserAgent, setHeader } from '../SiteUtilities';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.laftel',
  address: { hosts: ['laftel.net'] },
  title: 'Laftel',
  shortcut: { defaultKey: 'Control+Alt+2' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'OTT', order: 20, icon: LAFTEL_ICON },
  permissions: ['navigation', 'network-interception'],
})
export class LaftelSite extends UrlSiteDescriptor {
  protected readonly url = 'https://laftel.net/';
  private browserUserAgent?: string;
  private chromeMajorVersion = '134';

  protected async beforeLoad(): Promise<void> {
    this.browserUserAgent = createBrowserUserAgent(
      this.context.viewer.getUserAgent(),
    );
    this.chromeMajorVersion =
      /Chrome\/(\d+)/.exec(this.browserUserAgent)?.[1] ??
      this.chromeMajorVersion;
    this.context.viewer.setUserAgent(this.browserUserAgent);
  }

  onNewWindow(url: string): NewWindowPolicy {
    if (/^https:\/\/appleid\.apple\.com(?:[/:?#]|$)/i.test(url)) {
      return 'popup';
    }
    return 'viewer';
  }

  onBeforeSendHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    if (!this.browserUserAgent) return undefined;
    const hostname = /^https?:\/\/([^/:]+)/i.exec(details.url)?.[1]?.toLowerCase();
    if (!hostname || !isLaftelOrAppleHost(hostname)) return undefined;

    const headers = { ...details.requestHeaders };
    setHeader(headers, 'User-Agent', this.browserUserAgent);
    setHeader(
      headers,
      'Sec-Ch-Ua',
      `"Google Chrome";v="${this.chromeMajorVersion}", "Chromium";v="${this.chromeMajorVersion}", "Not_A Brand";v="24"`,
    );
    return headers;
  }

  async unload(): Promise<void> {
    if (this.browserUserAgent) this.context.viewer.setUserAgent();
    await super.unload();
  }
}

function isLaftelOrAppleHost(hostname: string): boolean {
  return (
    hostname === 'laftel.net' ||
    hostname.endsWith('.laftel.net') ||
    hostname === 'apple.com' ||
    hostname.endsWith('.apple.com')
  );
}
