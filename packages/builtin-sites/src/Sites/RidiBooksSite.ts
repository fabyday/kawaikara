import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.ridibooks',
  address: { hosts: ['ridibooks.com'] },
  title: 'RIDI',
  shortcut: { defaultKey: 'Control+Alt+R' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Books', order: 10, icon: 'https://ridibooks.com/favicon.ico' },
  permissions: ['navigation'],
})
export class RidiBooksSite extends UrlSiteDescriptor {
  protected readonly url = 'https://ridibooks.com/';
}
