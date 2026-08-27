import { AbstractUrlProvider, provider } from '@kawaikara/site-api';

/** Implements the tving site provider. */
@provider()
export class TvingProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.tving.com/';
}
