import { provider } from '@kawaikara/site-api';
import { CRUNCHYROLL_ICON } from '../../Icons';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.crunchyroll',
  address: { hosts: ['crunchyroll.com'] },
  title: 'Crunchyroll',
  shortcut: { defaultKey: 'Control+Alt+C' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 100, icon: CRUNCHYROLL_ICON },
  permissions: ['navigation'],
})
export class CrunchyrollProvider extends UrlProvider {
  protected readonly url = 'https://www.crunchyroll.com/';
}
