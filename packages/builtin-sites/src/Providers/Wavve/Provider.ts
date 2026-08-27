import { AbstractUrlProvider, provider } from '@kawaikara/site-api';
import { WAVVE_RESPONSIVE_VIEWPORT_SCRIPT } from './Inject/ResponsiveViewport';

/** Implements the wavve site provider. */
@provider({
  pictureInPicture: {
    contentOverlaySelectors: ['[class*="caption_wrap" i]'],
  },
})
export class WavveProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.wavve.com/';

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    this.subscriptions.add(this.requirePage().register({
      id: 'wavve.responsive-viewport',
      source: WAVVE_RESPONSIVE_VIEWPORT_SCRIPT,
    }));
  }
}
