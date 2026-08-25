import { provider } from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture([
    '[class*="caption_wrap" i]',
  ]),
})
export class WavveProvider extends UrlProvider {
  protected readonly url = 'https://www.wavve.com/';
}
