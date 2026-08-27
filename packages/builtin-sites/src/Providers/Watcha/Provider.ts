import {
  AbstractUrlProvider,
  createExternalLoginFlow,
  provider,
  type NewWindowPolicy,
  type SiteExternalLoginFlow,
  webPopupPolicy,
} from '@kawaikara/site-api';

/** Defines the shared WATCHA google login selector constant. */
const WATCHA_GOOGLE_LOGIN_SELECTOR =
  '[data-select="start-with-google"]';
/** Defines the shared WATCHA google login labels constant. */
const WATCHA_GOOGLE_LOGIN_LABELS = [
  'Google로 계속하기',
  'Continue with Google',
  'Googleで続ける',
] as const;

/** Implements the WATCHA site provider. */
@provider()
export class WatchaProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://watcha.com/';
  /** The google login flow value. */
  private googleLoginFlow?: SiteExternalLoginFlow;

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    this.googleLoginFlow = createExternalLoginFlow(this.context, {
      id: 'watcha-google',
      action: 'watcha:google-login',
      selector: WATCHA_GOOGLE_LOGIN_SELECTOR,
      fallbackLabels: WATCHA_GOOGLE_LOGIN_LABELS,
      login: () => ({
        startUrl: 'https://watcha.com/ko/sign_in',
        autoActivate: {
          selector: WATCHA_GOOGLE_LOGIN_SELECTOR,
          fallbackLabels: WATCHA_GOOGLE_LOGIN_LABELS,
        },
        completionUrlPattern:
          '/(?:[a-z]{2}(?:-[A-Z]{2})?/)?browse(?:[/?#]|$)',
        completionUrlFlags: 'i',
        returnUrl: 'https://watcha.com/ko/browse/all',
        resetSessionOrigins: ['https://watcha.com'],
        cookieImportMode: 'domain-scoped-https',
        awaitBrowserCleanup: true,
        siteTitle: 'Watcha · Google',
        locale: this.context.locale?.app,
      }),
    });
    this.subscriptions.add(this.googleLoginFlow);
  }

  /** Handles the action. */
  async onAction(action: string): Promise<boolean> {
    return this.googleLoginFlow?.handleAction(action) ?? false;
  }

  /** Handles the new window. */
  onNewWindow(url: string): NewWindowPolicy {
    // Google is intercepted above because Google rejects embedded user agents.
    // Apple and WATCHA's other OAuth popups keep opener semantics and the
    // Provider Session in an application-owned child window.
    return webPopupPolicy(url);
  }
}
