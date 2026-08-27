import {
  AbstractUrlProvider,
  createExternalLoginFlow,
  isSiteLoginNavigation,
  provider,
  type SiteExternalLoginFlow,
} from '@kawaikara/site-api';
/** Implements the Netflix site provider. */
@provider({
  pictureInPicture: {
    contentOverlaySelectors: [
      '.player-timedtext',
      '.player-timedtext-text-container',
      '[data-uia="player-subtitle"]',
    ],
  },
})
export class NetflixProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://netflix.com/';
  /** The login flow value. */
  private loginFlow?: SiteExternalLoginFlow;

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    this.loginFlow = createExternalLoginFlow(this.context, {
      id: 'netflix',
      selector: '[data-uia*="login" i], a[href*="/login" i], button[aria-label*="login" i], button[aria-label*="sign in" i]',
      fallbackLabels: ['sign in', 'log in', 'login', '로그인', 'ログイン'],
      login: () => ({
        startUrl: 'https://www.netflix.com/login',
        completionUrlPattern: '/browse(?:[/?#]|$)',
        returnUrl: 'https://www.netflix.com/browse',
        resetSessionOrigins: [
          'https://netflix.com',
          'https://www.netflix.com',
        ],
        siteTitle: 'Netflix',
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
    return !isSiteLoginNavigation(url, ['netflix.com'], ['/login']);
  }

  /** Performs the allow picture in picture operation. */
  allowPictureInPicture(value: string): boolean {
    try {
      const url = new URL(value);
      return /(^|\.)netflix\.com$/i.test(url.hostname) &&
        /^\/watch\/[^/]+/.test(url.pathname);
    } catch {
      return false;
    }
  }
}
