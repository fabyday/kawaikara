import { AbstractUrlProvider, provider } from '@kawaikara/site-api';

/** Implements the spotify site provider. */
@provider()
export class SpotifyProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://open.spotify.com/';
}
