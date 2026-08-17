import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.apple-music',
  address: { hosts: ['music.apple.com'] },
  title: 'Apple Music',
  shortcut: { defaultKey: 'Control+Alt+M' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Music', order: 10, icon: 'https://music.apple.com/favicon.ico' },
  permissions: ['navigation'],
})
export class AppleMusicSite extends UrlSiteDescriptor {
  protected readonly url = 'https://music.apple.com/';
}
