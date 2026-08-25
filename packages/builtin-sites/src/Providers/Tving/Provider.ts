import { provider } from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture(),
})
export class TvingProvider extends UrlProvider {
  protected readonly url = 'https://www.tving.com/';
}
