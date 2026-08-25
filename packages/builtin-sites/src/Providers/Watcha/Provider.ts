import { provider } from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture(),
})
export class WatchaProvider extends UrlProvider {
  protected readonly url = 'https://watcha.com/';
}
