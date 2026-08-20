import { provider } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.spotify',
  address: { hosts: ['open.spotify.com'] },
  title: 'Spotify',
  shortcut: { defaultKey: 'Control+Alt+S' },
  locale: BUILTIN_SITE_LOCALE,
  pictureInPicture: { enabled: false },
  menu: { category: 'Music', order: 20, icon: 'https://open.spotify.com/favicon.ico' },
  permissions: ['navigation'],
})
export class SpotifyProvider extends UrlProvider {
  protected readonly url = 'https://open.spotify.com/';
}
