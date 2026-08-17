import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.wavve',
  address: { hosts: ['wavve.com'] },
  title: 'Wavve',
  shortcut: { defaultKey: 'Control+Alt+7' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 50, icon: 'https://www.wavve.com/favicon.ico' },
  permissions: ['navigation'],
})
export class WavveSite extends UrlSiteDescriptor {
  protected readonly url = 'https://www.wavve.com/';
}
