import { AbstractUrlProvider, provider } from '@kawaikara/site-api';

/** Implements the prime video site provider. */
@provider({
  pictureInPicture: {
    contentOverlaySelectors: ['[class*="atvwebplayersdk-captions" i]'],
  },
})
export class PrimeVideoProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.primevideo.com/';
}
