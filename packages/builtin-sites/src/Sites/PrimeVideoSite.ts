import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.amazon-prime-video',
  address: { hosts: ['primevideo.com'] },
  title: 'Prime Video',
  shortcut: { defaultKey: 'Control+Alt+6' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 40, icon: 'https://www.primevideo.com/favicon.ico' },
  permissions: ['navigation'],
})
export class PrimeVideoSite extends UrlSiteDescriptor {
  protected readonly url = 'https://www.primevideo.com/';
}
