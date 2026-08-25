import {
  AbstractProvider,
  provider,
  type SiteContext,
} from '@kawaikara/site-api';

@provider()
export class VideoProvider extends AbstractProvider {
  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.context.viewer.loadInternalView('video');
  }
}
