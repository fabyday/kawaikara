import {
    AbstractUrlProvider,
    provider,
    type PictureInPictureSubtitleController,
    type ProviderPictureInPictureSession,
} from '@kawaikara/site-api';
import { CRUNCHYROLL_ICON } from '../../Icons';

/** Implements the crunchyroll site provider. */
@provider({
    menu: { category: 'OTT', order: 100, icon: CRUNCHYROLL_ICON },
})
export class CrunchyrollProvider extends AbstractUrlProvider {
    /** The URL value. */
    protected readonly url = 'https://www.crunchyroll.com/';

    /** Configure this player's captions through the shared, reversible PiP API. */
    createPictureInPictureSubtitleController(
        session: ProviderPictureInPictureSession,
    ): PictureInPictureSubtitleController {
        return session.createDomSubtitleController({
            /** Caption layers specific to this player. */
            overlaySelectors: ['[class*="erc-subtitle" i]'],
        });
    }
}
