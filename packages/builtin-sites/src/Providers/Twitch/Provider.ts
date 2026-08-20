import { provider } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.twitch',
  address: { hosts: ['twitch.tv'] },
  title: 'Twitch',
  shortcut: { defaultKey: 'Control+Alt+W' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Streaming', order: 20, icon: 'https://www.twitch.tv/favicon.ico' },
  permissions: ['navigation'],
})
export class TwitchProvider extends UrlProvider {
  protected readonly url = 'https://www.twitch.tv/';
}
