import { AbstractUrlProvider, provider } from '@kawaikara/site-api';

/** Implements the disney plus site provider. */
@provider({
  pictureInPicture: {
    contentOverlaySelectors: ['[class*="dss-subtitle" i]'],
  },
})
export class DisneyPlusProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.disneyplus.com/';
}
