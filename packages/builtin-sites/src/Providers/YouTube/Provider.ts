import { AbstractUrlProvider, provider, matchesSiteUrlHost,
  type NewWindowPolicy, type PictureInPictureSubtitleController,
  type ProviderPictureInPictureSession } from '@kawaikara/site-api';
import { repairIncompleteGoogleSession } from '../Google/SessionRepair';

/** Site navigation, authentication and PiP policy; Shorts is an attached Plugin. */
@provider()
export class YouTubeProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.youtube.com/';

  /** Configure this player's captions through the shared, reversible PiP API. */
  createPictureInPictureSubtitleController(
    session: ProviderPictureInPictureSession,
  ): PictureInPictureSubtitleController {
    return session.createDomSubtitleController({
      /** Caption layers specific to this player. */
      overlaySelectors: [
        '.ytp-caption-window-container',
        '.ytp-caption-window-bottom',
        '.caption-window',
        '.ytp-caption-segment',
      ],
      /** Position real caption windows, not the full-player buffer/container. */
      alignmentSelectors: ['.caption-window', '.ytp-caption-window-bottom'],
      /** Keep YouTube's line heights, clipping, and roll-up transforms unmodified. */
      scaleMode: 'box',
      /** A raised video-relative baseline; the App default remains unchanged elsewhere. */
      alignment: {
        /** Center against the video image, rather than cached player coordinates. */
        horizontal: 'center',
        /** Grow upward from a raised bottom baseline. */
        vertical: 'bottom',
        /** Leave eight percent of the displayed image below the caption window. */
        bottomInsetRatio: 0.08,
        /** Keep a visible gap in small PiP windows. */
        minimumBottomInsetPx: 12,
      },
    });
  }
  /** Authentication compatibility remains mandatory. */
  protected async beforeLoad(): Promise<void> {
    await repairIncompleteGoogleSession(this.context);
  }

  /** Handles the new window. */
  onNewWindow(url: string): NewWindowPolicy {
    if (matchesSiteUrlHost(url, ['accounts.google.com'])) return 'viewer';
    if (matchesSiteUrlHost(url, ['youtube.com', 'youtu.be'])) {
      return /^https?:\/\/(?:www\.)?youtube\.com\/(?:redirect\?|ads\/|pagead\/)/i.test(url)
        ? 'external'
        : 'viewer';
    }
    return 'external';
  }

  /** Performs the allow picture in picture operation. */
  allowPictureInPicture(value: string): boolean {
    const match =
      /^https:\/\/(?:www\.|m\.)?youtube\.com(\/[^?#]*)?(?:\?([^#]*))?(?:#|$)/i.exec(
        value,
      );
    if (!match) return false;
    const pathname = match[1] ?? '/';
    const query = match[2] ?? '';
    return (
      (pathname === '/watch' && /(?:^|&)v=[^&]+/.test(query)) ||
      /^\/(?:shorts|live)\/[^/]+\/?$/.test(pathname)
    );
  }

}
