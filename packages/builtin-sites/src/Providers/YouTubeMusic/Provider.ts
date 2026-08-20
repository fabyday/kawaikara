import { provider } from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { UrlProvider } from '../../UrlProvider';

@provider({
  id: 'kawaikara.youtube-music',
  address: { hosts: ['music.youtube.com'] },
  title: 'YouTube Music',
  shortcut: { defaultKey: 'Control+Alt+U' },
  locale: BUILTIN_SITE_LOCALE,
  isolation: { defaultBrowserProfile: 'google' },
  pictureInPicture: { enabled: false },
  menu: { category: 'Music', order: 30, icon: 'https://music.youtube.com/favicon.ico' },
  permissions: ['navigation'],
})
export class YouTubeMusicProvider extends UrlProvider {
  protected readonly url = 'https://music.youtube.com/';
}
