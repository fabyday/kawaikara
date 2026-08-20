import {
  AbstractProvider,
  provider,
  type SiteContext,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';

@provider({
  shortcut: { defaultKey: 'Control+Alt+4' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Video', order: 0, panel: 'video-library' },
  permissions: ['internal-view'],
})
export class VideoProvider extends AbstractProvider {
  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.context.viewer.loadInternalView('video');
  }
}
