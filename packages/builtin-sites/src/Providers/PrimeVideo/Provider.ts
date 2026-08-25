import { provider } from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture([
    '[class*="atvwebplayersdk-captions" i]',
  ]),
})
export class PrimeVideoProvider extends UrlProvider {
  protected readonly url = 'https://www.primevideo.com/';
}
