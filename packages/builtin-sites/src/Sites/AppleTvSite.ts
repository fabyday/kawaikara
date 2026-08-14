import { site } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { createBrowserUserAgent } from '../SiteUtilities';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

@site({
  id: 'kawaikara.apple-tv',
  title: 'Apple TV+',
  shortcut: { defaultKey: 'Control+Alt+A' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { drm: true },
  menu: { category: 'OTT', order: 90, icon: 'https://tv.apple.com/favicon.ico' },
  permissions: ['navigation'],
})
export class AppleTvSite extends UrlSiteDescriptor {
  protected readonly url = 'https://tv.apple.com/';

  protected async beforeLoad(): Promise<void> {
    this.context.viewer.setUserAgent(
      createBrowserUserAgent(this.context.viewer.getUserAgent()),
    );
  }

  async unload(): Promise<void> {
    this.context.viewer.setUserAgent();
    await super.unload();
  }
}
