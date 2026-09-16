import {
    AbstractUrlProvider,
    provider,
    type PictureInPictureSubtitleController,
    type ProviderPictureInPictureSession,
} from '@kawaikara/site-api';

/** Implements the prime video site provider. */
@provider({})
export class PrimeVideoProvider extends AbstractUrlProvider {
    /** The URL value. */
    protected readonly url = 'https://www.primevideo.com/';

    /** Configure this player's captions through the shared, reversible PiP API. */
    createPictureInPictureSubtitleController(
        session: ProviderPictureInPictureSession,
    ): PictureInPictureSubtitleController {
        return session.createDomSubtitleController({
            /** Caption layers specific to this player. */
            overlaySelectors: ['[class*="atvwebplayersdk-captions" i]'],
        });
    }
}
