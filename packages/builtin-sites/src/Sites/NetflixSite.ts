import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import {
  createLoginInterceptionScript,
  isLoginNavigation,
} from '../SiteUtilities';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.netflix',
  title: 'Netflix',
  shortcut: { defaultKey: 'Control+Alt+1' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 10, icon: 'https://netflix.com/favicon.ico' },
  permissions: [
    'navigation',
    'script-injection',
    'external-browser',
    'cookies',
  ],
})
export class NetflixSite extends UrlSiteDescriptor {
  protected readonly url = 'https://netflix.com/';
  private loginPending = false;

  protected async afterLoad(): Promise<void> {
    await this.context.viewer.executeJavaScript(
      createLoginInterceptionScript(
        '__kawaikaraNetflixLogin',
        '[data-uia="header-login-link"], a[href*="/login"], button[data-uia*="login"]',
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
        startUrl: 'https://www.netflix.com/login',
        completionUrlPattern: '/browse(?:[/?#]|$)',
        returnUrl: this.url,
        siteTitle: 'Netflix',
        locale: this.context.locale?.app,
      });
      this.context.logger.info(`Netflix external login ${result}.`);
    } finally {
      this.loginPending = false;
    }
    return true;
  }

  async unload(): Promise<void> {
    await this.context.externalBrowser.close();
    await super.unload();
  }

  allowNavigation(url: string): boolean {
    return !isLoginNavigation(url, ['netflix.com'], ['/login']);
  }
}
