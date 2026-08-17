import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.youtube-music',
  address: { hosts: ['music.youtube.com'] },
  title: 'YouTube Music',
  shortcut: { defaultKey: 'Control+Alt+U' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { defaultBrowserProfile: 'google' },
  menu: { category: 'Music', order: 30, icon: 'https://music.youtube.com/favicon.ico' },
  permissions: ['navigation'],
})
export class YouTubeMusicSite extends UrlSiteDescriptor {
  protected readonly url = 'https://music.youtube.com/';
}
