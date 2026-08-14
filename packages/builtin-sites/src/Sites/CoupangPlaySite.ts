import {
  site,
  type SiteRequestDetails,
  type SiteRequestHeaders,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import {
  createBrowserUserAgent,
  createLoginInterceptionScript,
  isLoginNavigation,
  setHeader,
} from '../SiteUtilities';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.coupang-play',
  title: 'Coupang Play',
  shortcut: { defaultKey: 'Control+Alt+9' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 70, icon: 'https://www.coupangplay.com/favicon.ico' },
  permissions: [
    'navigation',
    'script-injection',
    'external-browser',
    'cookies',
    'network-interception',
  ],
})
export class CoupangPlaySite extends UrlSiteDescriptor {
  protected readonly url = 'https://www.coupangplay.com/';
  private loginPending = false;
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

  protected async afterLoad(): Promise<void> {
    await this.context.viewer.executeJavaScript(
      createLoginInterceptionScript(
        '__kawaikaraCoupangLogin',
        '[data-cy="loginBtn"], a[href*="/login"]',
        this.context.actions.createUrl('login'),
      ),
    );
  }

  async onAction(action: string): Promise<boolean> {
    if (action !== 'login') return false;
    if (this.loginPending) return true;

    this.loginPending = true;
    try {
      const result = await this.context.externalBrowser.login({
        startUrl: this.url,
        completionUrlPattern: '/(?:home|profile)(?:[/?#]|$)',
        returnUrl: this.url,
        siteTitle: 'Coupang Play',
        locale: this.context.locale?.app,
      });
      this.context.logger.info(`Coupang Play external login ${result}.`);
    } finally {
      this.loginPending = false;
    }
    return true;
  }

  onBeforeSendHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    const hostname = /^https?:\/\/([^/:]+)/i.exec(details.url)?.[1]?.toLowerCase();
    if (!hostname) return undefined;
    if (hostname !== 'coupangplay.com' && !hostname.endsWith('.coupangplay.com')) {
      return undefined;
    }

    const headers = { ...details.requestHeaders };
    setHeader(
      headers,
      'Sec-Ch-Ua',
      `"Google Chrome";v="${this.chromeMajorVersion}", "Chromium";v="${this.chromeMajorVersion}", "Not_A Brand";v="24"`,
    );
    if (this.browserUserAgent) {
      setHeader(headers, 'User-Agent', this.browserUserAgent);
    }
    return headers;
  }

  allowNavigation(url: string): boolean {
    return !isLoginNavigation(url, ['coupangplay.com'], ['/login']);
  }

  async unload(): Promise<void> {
    await this.context.externalBrowser.close();
    this.context.viewer.setUserAgent();
    await super.unload();
  }
}
