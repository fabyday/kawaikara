import {
    AbstractUrlProvider,
    provider,
    type PictureInPictureSubtitleController,
    type ProviderPictureInPictureSession,
} from '@kawaikara/site-api';
import { WAVVE_RESPONSIVE_VIEWPORT_SCRIPT } from './Inject/ResponsiveViewport';

/** Implements the wavve site provider. */
@provider({})
export class WavveProvider extends AbstractUrlProvider {
    /** The URL value. */
    protected readonly url = 'https://www.wavve.com/';

    /** Configure this player's captions through the shared, reversible PiP API. */
    createPictureInPictureSubtitleController(
        session: ProviderPictureInPictureSession,
    ): PictureInPictureSubtitleController {
        return session.createDomSubtitleController({
            /** Caption layers specific to this player. */
            overlaySelectors: ['[class*="caption_wrap" i]'],
        });
    }

    /** Performs the before load operation. */
    protected async beforeLoad(): Promise<void> {
        this.subscriptions.add(
            this.requirePage().register({
                id: 'wavve.responsive-viewport',
                source: WAVVE_RESPONSIVE_VIEWPORT_SCRIPT,
            }),
        );
    }
}
