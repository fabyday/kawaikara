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
  protected readonly url = 'https://www.netflix.com/';
  /** The login flow value. */
  private loginFlow?: SiteExternalLoginFlow;
  /** Whether Netflix redirected the stored Session to its blocked login page. */
  private loginNavigationBlocked = false;

  /** Loads Netflix, recovering an expired stored login Session once. */
  async load(): Promise<void> {
    this.loginNavigationBlocked = false;
    try {
      await super.load();
      return;
    } catch (error) {
      if (
        !this.loginNavigationBlocked ||
        !isFailedNavigation(error) ||
        !this.context.cookies
      ) {
        throw error;
      }
    }

    // Netflix can redirect an expired authenticated Session through /browse
    // and then directly to /login. The Provider deliberately keeps /login out
    // of the embedded viewer because authentication belongs to the external
    // browser. Once Netflix has rejected that Session, its cookies no longer
    // represent a usable login and leave the viewer on an empty document.
    const clearedCookieCount = await this.context.cookies.clear({
      domains: ['netflix.com'],
    });
    this.context.logger.warn(
      'Netflix rejected the stored login Session; cleared its cookies and restored the public page.',
      { clearedCookieCount },
    );
    this.loginNavigationBlocked = false;
    await this.context.viewer.loadURL(this.url);
    await this.loginFlow?.refresh();
  }

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    this.loginFlow = createExternalLoginFlow(this.context, {
      id: 'netflix',
      selector: '[data-uia*="login" i], a[href*="/login" i], button[aria-label*="login" i], button[aria-label*="sign in" i]',
      fallbackLabels: ['sign in', 'log in', 'login', '로그인', 'ログイン'],
      login: () => ({
        startUrl: 'https://www.netflix.com/login',
        completionUrlPattern: '/browse(?:[/?#]|$)',
        // Restore the public home page on both completion and cancellation.
        // Loading /browse without a completed login redirects to /login,
        // which this Provider intentionally blocks inside the embedded view.
        returnUrl: 'https://www.netflix.com/',
        // Match the working main-branch cookie conversion. Netflix expects
        // its login cookies to be written from an HTTPS domain scope; keeping
        // Patchright host-only scope can leave a conflicting Electron cookie.
        cookieImportMode: 'domain-scoped-https',
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
    const login = isSiteLoginNavigation(url, ['netflix.com'], ['/login']);
    if (login) this.loginNavigationBlocked = true;
    return !login;
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

/** Determines whether Electron rejected a guarded main-frame navigation. */
function isFailedNavigation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown }).code === 'ERR_FAILED';
}
