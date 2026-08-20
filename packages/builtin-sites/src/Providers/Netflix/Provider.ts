import { provider } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import {
  createLoginInterceptionScript,
  isLoginNavigation,
} from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.netflix',
  address: { hosts: ['netflix.com'] },
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
export class NetflixProvider extends UrlProvider {
  protected readonly url = 'https://netflix.com/';
  private loginPending = false;
  private loginInjectionReady = false;

  protected async afterLoad(): Promise<void> {
    const result = await this.context.viewer.executeJavaScript<{
      readonly installed?: boolean;
      readonly ready?: boolean;
    }>(
      createLoginInterceptionScript(
        '__kawaikaraNetflixLogin',
        '[data-uia*="login" i], a[href*="/login" i], button[aria-label*="login" i], button[aria-label*="sign in" i]',
        this.context.actions.createUrl('login'),
        ['sign in', 'log in', 'login', '로그인', 'ログイン'],
      ),
    );
    this.loginInjectionReady = result.installed === true && result.ready === true;
  }

  async onAction(action: string): Promise<boolean> {
    if (action !== 'login') return false;
    if (this.loginPending) return true;
    if (!this.loginInjectionReady) {
      await this.afterLoad();
      if (!this.loginInjectionReady) {
        this.context.logger.warn('Netflix login was blocked until injection is ready.');
        return true;
      }
    }

    this.loginPending = true;
    try {
      const result = await this.context.externalBrowser.login({
        startUrl: 'https://www.netflix.com/login',
        completionUrlPattern: '/browse(?:[/?#]|$)',
        siteTitle: 'Netflix',
        locale: this.context.locale?.app,
      });
      this.context.logger.info(`Netflix external login ${result}.`);
      await this.afterLoad().catch((error: unknown) => {
        this.context.logger.debug('Netflix login interception refresh was skipped.', error);
      });
    } finally {
      this.loginPending = false;
    }
    return true;
  }

  async unload(): Promise<void> {
    this.loginInjectionReady = false;
    await this.context.externalBrowser.close();
    await super.unload();
  }

  allowNavigation(url: string): boolean {
    return !isLoginNavigation(url, ['netflix.com'], ['/login']);
  }
}
