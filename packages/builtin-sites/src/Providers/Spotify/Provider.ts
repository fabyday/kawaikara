import { provider } from '@kawaikara/site-api';
import { UrlProvider } from '../../UrlProvider';

@provider()
export class SpotifyProvider extends UrlProvider {
  protected readonly url = 'https://open.spotify.com/';
}
