import {
  AbstractUrlProvider,
  provider,
  type NewWindowPolicy,
  webPopupPolicy,
  type PictureInPictureSubtitleController,
  type ProviderPictureInPictureSession,
} from '@kawaikara/site-api';
import { createAppleStorefrontPersistenceScript } from './Inject/StorefrontPersistence';

/** Implements the apple tv site provider. */
@provider({})
export class AppleTvProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://tv.apple.com/';

  /** Configure this player's captions through the shared, reversible PiP API. */
  createPictureInPictureSubtitleController(
    session: ProviderPictureInPictureSession,
  ): PictureInPictureSubtitleController {
    return session.createDomSubtitleController({
      /** Caption layers specific to this player. */
      overlaySelectors: [
        '[class*="apple-web-player" i] [class*="caption" i]',
      ],
    });
  }

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
