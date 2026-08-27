import { AbstractUrlProvider, provider } from '@kawaikara/site-api';
import { CRUNCHYROLL_ICON } from '../../Icons';

/** Implements the crunchyroll site provider. */
@provider({
  menu: { category: 'OTT', order: 100, icon: CRUNCHYROLL_ICON
  },
  pictureInPicture: {
    contentOverlaySelectors: ['[class*="erc-subtitle" i]'],
  },
})
export class CrunchyrollProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.crunchyroll.com/';
}
