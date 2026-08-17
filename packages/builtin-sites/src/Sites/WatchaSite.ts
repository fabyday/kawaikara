import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.watcha',
  address: { hosts: ['watcha.com'] },
  title: 'Watcha',
  shortcut: { defaultKey: 'Control+Alt+8' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 60, icon: 'https://watcha.com/favicon.ico' },
  permissions: ['navigation'],
})
export class WatchaSite extends UrlSiteDescriptor {
  protected readonly url = 'https://watcha.com/';
}
