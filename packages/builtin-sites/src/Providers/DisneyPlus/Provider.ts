import { provider } from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture([
    '[class*="dss-subtitle" i]',
  ]),
})
export class DisneyPlusProvider extends UrlProvider {
  protected readonly url = 'https://www.disneyplus.com/';
}
