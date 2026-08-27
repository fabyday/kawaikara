import {
  AbstractUrlProvider,
  createExternalLoginFlow,
  isSiteLoginNavigation,
  provider,
  type SiteExternalLoginFlow,
} from '@kawaikara/site-api';

/** Implements the coupang play site provider. */
@provider()
export class CoupangPlayProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.coupangplay.com/';
  /** The login flow value. */
  private loginFlow?: SiteExternalLoginFlow;

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    this.loginFlow = createExternalLoginFlow(this.context, {
      id: 'coupang-play',
      selector: '[data-cy*="login" i], [data-testid*="login" i], a[href*="/login" i], button[aria-label*="login" i]',
      fallbackLabels: ['sign in', 'log in', 'login', '로그인', 'ログイン'],
      login: () => ({
        startUrl: this.url,
        completionUrlPattern: '/(?:home|profile)',
        replaceSessionCookies: true,
        cookieImportMode: 'domain-scoped-https',
        resetSessionOrigins: [
          'https://coupangplay.com',
          'https://www.coupangplay.com',
        ],
        awaitBrowserCleanup: true,
        siteTitle: 'Coupang Play',
        locale: this.context.locale?.app,
      }),
    });
    this.subscriptions.add(this.loginFlow);
  }

  /** Handles the action. */
  async onAction(action: string): Promise<boolean> {
    return this.loginFlow?.handleAction(action) ?? false;
  }

  /** Performs the allow navigation operation. */
  allowNavigation(url: string): boolean {
    return !isSiteLoginNavigation(url, ['coupangplay.com'], ['/login']);
  }

}
