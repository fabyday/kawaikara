import {
  AbstractProvider,
  provider,
  type SiteContext,
} from '@kawaikara/site-api';
/** Implements the video site provider. */
@provider({
  menu: {
    category: 'Video',
    panels: [
      {
        id: 'library',
        content: { kind: 'internal', viewId: 'video-library'
        },
      },
    ],
  },
})
export class VideoProvider extends AbstractProvider {
  /** Creates an instance of VideoProvider. */
  constructor(context: SiteContext) {
    super(context);
  }

  /** Loads the operation. */
  async load(): Promise<void> {
    await this.context.viewer.loadInternalView('video');
  }
}
