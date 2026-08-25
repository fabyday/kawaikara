import { provider } from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture([
    '[data-a-target="player-captions-container"]',
  ]),
})
export class TwitchProvider extends UrlProvider {
  protected readonly url = 'https://www.twitch.tv/';
}
