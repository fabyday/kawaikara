import { provider } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.watcha',
  address: { hosts: ['watcha.com'] },
  title: 'Watcha',
  shortcut: { defaultKey: 'Control+Alt+8' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 60, icon: 'https://watcha.com/favicon.ico' },
  permissions: ['navigation'],
})
export class WatchaProvider extends UrlProvider {
  protected readonly url = 'https://watcha.com/';
}
