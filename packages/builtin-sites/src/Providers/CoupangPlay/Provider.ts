import {
  provider,
  type SiteRequestDetails,
  type SiteRequestHeaders,
} from '@kawaikara/site-api';
import { createVideoPictureInPicture } from '../../PictureInPicture';
import {
  createLoginInterceptionScript,
  isLoginNavigation,
  setHeader,
} from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';

const COUPANG_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const COUPANG_CLIENT_HINT =
  '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
const COUPANG_PIP_SUBTITLE_SELECTORS = [
  '.vjs-text-track-display',
  '.vjs-text-track-cue',
  '.shaka-text-container',
] as const;

@provider({
  pictureInPicture: createVideoPictureInPicture(
    COUPANG_PIP_SUBTITLE_SELECTORS,
  ),
})
export class CoupangPlayProvider extends UrlProvider {
  protected readonly url = 'https://www.coupangplay.com/';
  private loginPending = false;
  private loginInjectionReady = false;

  protected async beforeLoad(): Promise<void> {
    // Coupang's Akamai flow is sensitive to Electron's browser identity. Keep
    // the legacy main-branch identity that is known to complete playback login.
    this.context.viewer.setUserAgent(COUPANG_USER_AGENT);
  }

  protected async afterLoad(): Promise<void> {
    const result = await this.context.viewer.executeJavaScript<{
      readonly installed?: boolean;
      readonly ready?: boolean;
    }>(
      createLoginInterceptionScript(
        '__kawaikaraCoupangLogin',
        '[data-cy*="login" i], [data-testid*="login" i], a[href*="/login" i], button[aria-label*="login" i]',
        this.context.actions.createUrl('login'),
        ['sign in', 'log in', 'login', '로그인', 'ログイン'],
      ),
    );
    this.loginInjectionReady = result.installed === true && result.ready === true;
  }

  async onAction(action: string): Promise<boolean> {
    if (action !== 'login') return false;
    if (this.loginPending) return true;
    if (!this.loginInjectionReady) {
      await this.afterLoad();
      if (!this.loginInjectionReady) {
        this.context.logger.warn(
          'Coupang Play login was blocked until injection is ready.',
        );
        return true;
      }
    }

    this.loginPending = true;
    try {
      const result = await this.context.externalBrowser.login({
        startUrl: this.url,
        // Coupang currently uses both /profile and /profiles-style routes.
        // Match the legacy main-branch behavior so the browser closes as soon
        // as either the profile surface or the authenticated home opens.
        completionUrlPattern: '/(?:home|profile)',
        // This Session is site-isolated. Import the external browser's final
        // cookie jar as the sole source of truth instead of merging stale
        // Akamai and authentication cookies from a previous attempt.
        replaceSessionCookies: true,
        cookieImportMode: 'domain-scoped-https',
        resetSessionOrigins: [
          'https://coupangplay.com',
          'https://www.coupangplay.com',
        ],
        // The last known-good implementation returned to the original root
        // document only after Chrome had fully closed. Forcing /home starts a
        // protected request before Coupang has rebuilt its viewer session.
        awaitBrowserCleanup: true,
        siteTitle: 'Coupang Play',
        locale: this.context.locale?.app,
      });
      this.context.logger.info(`Coupang Play external login ${result}.`);
      await this.afterLoad().catch((error: unknown) => {
        this.context.logger.debug(
          'Coupang Play login interception refresh was skipped.',
          error,
        );
      });
    } finally {
      this.loginPending = false;
    }
    return true;
  }

  onBeforeSendHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    const hostname = /^https?:\/\/([^/:]+)/i.exec(details.url)?.[1]?.toLowerCase();
    if (!hostname) return undefined;
    if (!isCoupangHost(hostname)) {
      return undefined;
    }

    const headers = { ...details.requestHeaders };
    setHeader(
      headers,
      'Sec-Ch-Ua',
      COUPANG_CLIENT_HINT,
    );
    setHeader(headers, 'User-Agent', COUPANG_USER_AGENT);
    return headers;
  }

  allowNavigation(url: string): boolean {
    return !isLoginNavigation(url, ['coupangplay.com'], ['/login']);
  }

  async unload(): Promise<void> {
    this.loginInjectionReady = false;
    await this.context.externalBrowser.close();
    this.context.viewer.setUserAgent();
    await super.unload();
  }
}

function isCoupangHost(hostname: string): boolean {
  return hostname === 'coupangplay.com' ||
    hostname.endsWith('.coupangplay.com') ||
    hostname === 'coupang.com' ||
    hostname.endsWith('.coupang.com');
}
