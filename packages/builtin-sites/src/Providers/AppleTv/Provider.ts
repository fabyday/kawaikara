import {
  AbstractUrlProvider,
  provider,
  type NewWindowPolicy,
  webPopupPolicy,
} from '@kawaikara/site-api';
import { createAppleStorefrontPersistenceScript } from './Inject/StorefrontPersistence';

/** Implements the apple tv site provider. */
@provider({
  pictureInPicture: {
    contentOverlaySelectors: [
      '[class*="apple-web-player" i] [class*="caption" i]',
    ],
  },
})
export class AppleTvProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://tv.apple.com/';

  /** Handles the new window. */
  onNewWindow(url: string): NewWindowPolicy {
    // Apple Account authentication must retain the Provider Session, so use a
    // separate Electron popup rather than replacing the Apple TV viewer.
    return webPopupPolicy(url);
  }

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    // A storefront selects the regional catalog, not merely display language.
    this.subscriptions.add(this.requirePage().register({
      id: 'apple-tv.storefront-persistence',
      source: createAppleStorefrontPersistenceScript(),
    }));
  }
}
