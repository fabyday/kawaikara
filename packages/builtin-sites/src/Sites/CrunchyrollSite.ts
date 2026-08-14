import { site } from '@kawaikara/site-api';
import { CRUNCHYROLL_ICON } from '../Icons';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.crunchyroll',
  title: 'Crunchyroll',
  shortcut: { defaultKey: 'Control+Alt+C' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 100, icon: CRUNCHYROLL_ICON },
  permissions: ['navigation'],
})
export class CrunchyrollSite extends UrlSiteDescriptor {
  protected readonly url = 'https://www.crunchyroll.com/';
}
