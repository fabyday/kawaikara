import { provider } from '@kawaikara/site-api';
import { CRUNCHYROLL_ICON } from '../../Icons';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import { UrlProvider } from '../../UrlProvider';

@provider({
  pictureInPicture: createVideoPictureInPicture([
    '[class*="erc-subtitle" i]',
  ]),
  menu: { category: 'OTT', order: 100, icon: CRUNCHYROLL_ICON },
})
export class CrunchyrollProvider extends UrlProvider {
  protected readonly url = 'https://www.crunchyroll.com/';
}
