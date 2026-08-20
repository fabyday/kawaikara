import { provider } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.disneyplus',
  address: { hosts: ['disneyplus.com'] },
  title: 'Disney+',
  shortcut: { defaultKey: 'Control+Alt+3' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 30, icon: 'https://www.disneyplus.com/favicon.ico' },
  permissions: ['navigation'],
})
export class DisneyPlusProvider extends UrlProvider {
  protected readonly url = 'https://www.disneyplus.com/';
}
