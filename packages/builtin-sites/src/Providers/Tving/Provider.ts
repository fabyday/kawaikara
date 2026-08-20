import { provider } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.tving',
  address: { hosts: ['tving.com'] },
  title: 'TVING',
  shortcut: { defaultKey: 'Control+Alt+T' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 80, icon: 'https://www.tving.com/favicon.ico' },
  permissions: ['navigation'],
})
export class TvingProvider extends UrlProvider {
  protected readonly url = 'https://www.tving.com/';
}
