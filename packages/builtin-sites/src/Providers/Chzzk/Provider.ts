import { AbstractUrlProvider, provider, webAuthenticationPolicy, matchesSiteUrlHost,
  type NewWindowPolicy, type PictureInPictureSubtitleController,
  type ProviderPictureInPictureSession } from '@kawaikara/site-api';

/** Site identity and player policy; optional behavior belongs to attached Plugins. */
@provider({
  pictureInPicture: {
    pageRequestPolicy: 'allow',
    pageControlSelectors: [
      '.pzp-pc-pip-button',
      '.pzp-pc__pip-button',
      '.pzp-pc-ui-button[aria-label="PIP" i]',
      '.pzp-pc__setting-button[aria-label="PIP" i]',
      'button[label="PIP" i]',
    ],
  },
})
export class ChzzkProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://chzzk.naver.com/';

  /** Configure this player's captions through the shared, reversible PiP API. */
  createPictureInPictureSubtitleController(
    session: ProviderPictureInPictureSession,
  ): PictureInPictureSubtitleController {
    return session.createDomSubtitleController({
      /** Caption layers specific to this player. */
      overlaySelectors: [
        '.pzp-pc__subtitle',
        '.pzp-pc-subtitle',
        '.pzp-pc__caption',
      ],
    });
  }
  /** Handles the new window. */
  onNewWindow(url: string): NewWindowPolicy {
    // Channel/profile links inside Clips use target=_blank. They are ordinary
    // CHZZK navigation and belong in the existing viewer, not a second app
    // window. Naver and other authentication origins still need a real popup
    // with opener semantics and the shared Provider Session.
    if (matchesSiteUrlHost(url, ['chzzk.naver.com', 'm.naver.com'])) {
      return 'viewer';
    }
    return webAuthenticationPolicy(url, 'popup');
  }

  /** Performs the allow picture in picture operation. */
  allowPictureInPicture(value: string): boolean {
    const match = /^https:\/\/chzzk\.naver\.com(\/[^?#]*)?(?:[?#]|$)/i.exec(
      value,
    );
    const pathname = match?.[1] ?? '/';
    return /^\/(?:live|video|clips)\/[^/]+\/?$/.test(pathname);
  }

}
