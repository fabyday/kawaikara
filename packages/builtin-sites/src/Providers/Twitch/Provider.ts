import { AbstractUrlProvider, provider } from '@kawaikara/site-api';

/** Implements the twitch site provider. */
@provider({
  pictureInPicture: {
    contentOverlaySelectors: ['[data-a-target="player-captions-container"]'],
  },
})
export class TwitchProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.twitch.tv/';
}
