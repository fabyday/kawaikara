import {
  AbstractUrlProvider,
  provider,
} from '@kawaikara/site-api';
import { LAFTEL_ICON } from '../../Icons';

/** Implements the laftel site provider. */
@provider({
  menu: { category: 'OTT', order: 20, icon: LAFTEL_ICON
  },
  pictureInPicture: {
    pageControlSelectors: [
      '[class*="player" i] button[aria-label="PIP" i]',
      '[class*="player" i] [role="button"][aria-label="PIP" i]',
      '[class*="player" i] button[class*="pip" i]',
      '[class*="player" i] [role="button"][class*="pip" i]',
      '.vjs-picture-in-picture-control',
    ],
  },
})
export class LaftelProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://laftel.net/';

}
