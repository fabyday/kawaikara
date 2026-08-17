import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.spotify',
  address: { hosts: ['open.spotify.com'] },
  title: 'Spotify',
  shortcut: { defaultKey: 'Control+Alt+S' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Music', order: 20, icon: 'https://open.spotify.com/favicon.ico' },
  permissions: ['navigation'],
})
export class SpotifySite extends UrlSiteDescriptor {
  protected readonly url = 'https://open.spotify.com/';
}
