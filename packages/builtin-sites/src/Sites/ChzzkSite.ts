import {
  site,
  type SiteRequestDetails,
  type SiteRequestHeaders,
  type SiteRequestRedirect,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../SiteDefaults';
import { setHeader } from '../SiteUtilities';
import { UrlSiteDescriptor } from '../UrlSiteDescriptor';

const CHZZK_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CHZZK_AD_BLOCKER_SCRIPT_URL =
  'https://raw.githubusercontent.com/krkarma777/UltraFastAdSkipperFromCHZZK/main/CHZZK-Ad-Blocker.user.js';

const CHZZK_QUALITY_LABEL_SCRIPT = `
(() => {
  const stateKey = '__kawaikaraChzzkQualityLabel';
  const state = globalThis[stateKey] ?? { attempts: 0 };
  globalThis[stateKey] = state;

  const updateQualityLabel = () => {
    if (state.attempts > 12) return;
    state.attempts += 1;

    const items = document.querySelectorAll(
      'div.pzp-setting-quality-pane > div:nth-child(2) > ul > li',
    );
    const qualityElement = Array.from(items).find((element) =>
      element.textContent?.trim().includes('480p'),
    );
    const liveDetails = document.querySelector("div[class^='live_information_details']");
    const labelTarget = qualityElement?.querySelector('li > div:nth-child(2) > span > div');

    if (liveDetails && labelTarget) {
      labelTarget.innerHTML =
        '<span class="pzp-pc-ui-setting-quality-item__prefix">1080p&nbsp;<div class="pzp-ui-track-badge"><em style="vertical-align:super;" class="pzp-ui-track-badge__badge">Kawaikara</em></div></span>';
      return;
    }
    window.setTimeout(updateQualityLabel, 500);
  };

  updateQualityLabel();
})();
`;

const CHZZK_AD_BLOCKER_LOADER_SCRIPT = `
(() => {
  const stateKey = '__kawaikaraChzzkAdBlocker';
  const state = globalThis[stateKey] ?? { loading: false, loaded: false };
  globalThis[stateKey] = state;
  if (state.loading || state.loaded) return;
  state.loading = true;

  fetch(${JSON.stringify(CHZZK_AD_BLOCKER_SCRIPT_URL)}, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    })
    .then((script) => {
      Function(script)();
      state.loaded = true;
    })
    .catch((error) => {
      console.warn('[Kawaikara] CHZZK ad blocker script failed to load.', error);
    })
    .finally(() => {
      state.loading = false;
    });
})();
`;

@site({
  id: 'kawaikara.chzzk',
  address: { hosts: ['chzzk.naver.com'] },
  title: 'CHZZK',
  shortcut: { defaultKey: 'Control+Alt+Z' },
  locale: BUILTIN_SITE_LOCALE,
  menu: { category: 'Streaming', order: 10, icon: 'https://chzzk.naver.com/favicon.ico' },
  permissions: ['navigation', 'network-interception', 'script-injection'],
})
export class ChzzkSite extends UrlSiteDescriptor {
  protected readonly url = 'https://chzzk.naver.com/';

  protected async beforeLoad(): Promise<void> {
    this.context.viewer.setUserAgent(CHZZK_BROWSER_USER_AGENT);
  }

  protected async afterLoad(): Promise<void> {
    await this.context.viewer.executeJavaScript(CHZZK_QUALITY_LABEL_SCRIPT);
    await this.context.viewer.executeJavaScript(CHZZK_AD_BLOCKER_LOADER_SCRIPT);
  }

  onBeforeRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined {
    if (details.method !== 'GET') return undefined;
    if (!isChzzkMediaPlaylistUrl(details.url)) return undefined;

    const redirectURL = details.url.replace(/480p/g, '1080p');
    if (redirectURL === details.url) return undefined;
    return { redirectURL };
  }

  onBeforeSendHeaders(
    details: SiteRequestDetails,
  ): SiteRequestHeaders | undefined {
    if (!isChzzkRelatedUrl(details.url)) return undefined;
    const headers = { ...details.requestHeaders };
    setHeader(headers, 'User-Agent', CHZZK_BROWSER_USER_AGENT);
    return headers;
  }

  allowPictureInPicture(value: string): boolean {
    const match = /^https:\/\/chzzk\.naver\.com(\/[^?#]*)?(?:[?#]|$)/i.exec(
      value,
    );
    const pathname = match?.[1] ?? '/';
    return /^\/(?:live|video|clips)\/[^/]+\/?$/.test(pathname);
  }

  async unload(): Promise<void> {
    this.context.viewer.setUserAgent();
    await super.unload();
  }
}

function isChzzkMediaPlaylistUrl(value: string): boolean {
  if (!/\.m3u8(?:[?#]|$)/i.test(value) || !value.includes('480p')) return false;
  return isChzzkRelatedUrl(value);
}

function isChzzkRelatedUrl(value: string): boolean {
  const hostname = /^https?:\/\/([^/:]+)/i.exec(value)?.[1]?.toLowerCase();
  if (!hostname) return false;
  return (
    hostname === 'chzzk.naver.com' ||
    hostname.endsWith('.chzzk.naver.com') ||
    hostname === 'naver.com' ||
    hostname.endsWith('.naver.com') ||
    hostname === 'pstatic.net' ||
    hostname.endsWith('.pstatic.net')
  );
}
