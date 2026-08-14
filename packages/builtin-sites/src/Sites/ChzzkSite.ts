import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.chzzk',
  title: 'CHZZK',
  shortcut: { defaultKey: 'Control+Alt+Z' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Streaming', order: 10, icon: 'https://chzzk.naver.com/favicon.ico' },
  permissions: ['navigation'],
})
export class ChzzkSite extends UrlSiteDescriptor {
  protected readonly url = 'https://chzzk.naver.com/';

  allowPictureInPicture(value: string): boolean {
    const match = /^https:\/\/chzzk\.naver\.com(\/[^?#]*)?(?:[?#]|$)/i.exec(
      value,
    );
    const pathname = match?.[1] ?? '/';
    return /^\/(?:live|video|clips)\/[^/]+\/?$/.test(pathname);
  }
}
