import { site, type NewWindowPolicy } from '@kawaikara/site-api';
import { LAFTEL_ICON } from '../Icons';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.laftel',
  title: 'Laftel',
  shortcut: { defaultKey: 'Control+Alt+2' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'OTT', order: 20, icon: LAFTEL_ICON },
  permissions: ['navigation'],
})
export class LaftelSite extends UrlSiteDescriptor {
  protected readonly url = 'https://laftel.net/';

  onNewWindow(url: string): NewWindowPolicy {
    if (/^https:\/\/appleid\.apple\.com(?:[/:?#]|$)/i.test(url)) {
      return 'popup';
    }
    return 'viewer';
  }
}
