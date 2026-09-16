import {
    AbstractUrlProvider,
    provider,
    type PictureInPictureSubtitleController,
    type ProviderPictureInPictureSession,
} from '@kawaikara/site-api';

/** Implements the twitch site provider. */
@provider({})
export class TwitchProvider extends AbstractUrlProvider {
    /** The URL value. */
    protected readonly url = 'https://www.twitch.tv/';

    /** Configure this player's captions through the shared, reversible PiP API. */
    createPictureInPictureSubtitleController(
        session: ProviderPictureInPictureSession,
    ): PictureInPictureSubtitleController {
        return session.createDomSubtitleController({
            /** Caption layers specific to this player. */
            overlaySelectors: ['[data-a-target="player-captions-container"]'],
        });
    }
}
