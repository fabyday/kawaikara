import {
  AbstractProvider,
  provider,
  type SiteContext,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';

@provider({
  shortcut: { defaultKey: 'Control+Alt+4' },
  locale: BUILTIN_SITE_LOCALE,
  menu: {
    category: 'Video',
    order: 0,
    panels: [{
      id: 'library',
      title: { 'en-US': 'Library', 'ko-KR': '라이브러리', 'ja-JP': 'ライブラリ' },
      content: { kind: 'internal', viewId: 'video-library' },
    }],
  },
  permissions: ['internal-view', 'plugin-view'],
})
export class VideoProvider extends AbstractProvider {
  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.context.viewer.loadInternalView('video');
  }
}
