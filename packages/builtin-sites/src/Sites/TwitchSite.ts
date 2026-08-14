import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.twitch',
  title: 'Twitch',
  shortcut: { defaultKey: 'Control+Alt+W' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Streaming', order: 20, icon: 'https://www.twitch.tv/favicon.ico' },
  permissions: ['navigation'],
})
export class TwitchSite extends UrlSiteDescriptor {
  protected readonly url = 'https://www.twitch.tv/';
}
