import {
  AbstractSiteDescriptor,
  site,
  type SiteContext,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';

@site({
  id: 'kawaikara.video',
  title: 'Video',
  shortcut: { defaultKey: 'Control+Alt+4' },
  locale: BUILTIN_SITE_LOCALE,
  description: 'Play a local video file or an HLS stream.',
  menu: { category: 'Video', order: 0, panel: 'video-library' },
  permissions: ['internal-view'],
})
export class VideoSite extends AbstractSiteDescriptor {
  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.context.viewer.loadInternalView('video');
  }
}
