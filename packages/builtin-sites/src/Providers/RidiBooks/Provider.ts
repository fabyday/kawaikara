import {
  AbstractUrlProvider,
  provider,
  type NewWindowPolicy,
  webPopupPolicy,
} from '@kawaikara/site-api';

/** Implements the ridi books site provider. */
@provider()
export class RidiBooksProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://ridibooks.com/';

  /** Handles the new window. */
  onNewWindow(url: string): NewWindowPolicy {
    // RIDI's SNS providers (Apple, Google, Kakao, and Naver) use popup-based
    // OAuth. Keeping the popup in the Provider Session lets the resulting
    // login cookies become visible to the original RIDI viewer.
    return webPopupPolicy(url);
  }

}
