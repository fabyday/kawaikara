import {
  AbstractUrlProvider,
  provider,
  type NewWindowPolicy,
  webPopupPolicy,
} from '@kawaikara/site-api';

/** Implements the apple music site provider. */
@provider()
export class AppleMusicProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://music.apple.com/';

  /** Handles the new window. */
  onNewWindow(url: string): NewWindowPolicy {
    // Apple Music and Apple TV share the Apple Account popup flow.
    return webPopupPolicy(url);
  }

}
