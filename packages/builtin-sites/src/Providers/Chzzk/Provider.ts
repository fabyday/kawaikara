import {
  SHORT_FORM_VIDEO_ACTIONS,
  SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING,
  provider,
  type ProviderSettings,
  type SiteRequestDetails,
  type SiteRequestHeaders,
  type SiteRequestRedirect,
} from '@kawaikara/site-api';
import { BUILTIN_SITE_LOCALE } from '../../SiteDefaults';
import { setHeader } from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';
import {
  CHZZK_AD_RESPONSE_BLOCKER_SCRIPT,
  CHZZK_AD_SKIPPER_SCRIPT,
  createChzzkClipsCommandScript,
  createChzzkClipsInjectionScript,
  createChzzkQualityEnhancementScript,
  type ChzzkClipsInjectionOptions,
} from './Inject/Index';

const CHZZK_ENABLE_1080_BYPASS_ACTION = 'chzzk:quality:enable-1080';
const CHZZK_DISABLE_1080_BYPASS_ACTION = 'chzzk:quality:disable-1080';

const CHZZK_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CHZZK_PIP_CONTROL_SELECTORS = [
  '.pzp-pc-pip-button',
  '.pzp-pc__pip-button',
  '.pzp-pc-ui-button[aria-label="PIP" i]',
  '.pzp-pc__setting-button[aria-label="PIP" i]',
  'button[label="PIP" i]',
] as const;

@provider({
  id: 'kawaikara.chzzk',
  address: { hosts: ['chzzk.naver.com'] },
  title: 'CHZZK',
  shortcut: { defaultKey: 'Control+Alt+Z' },
  settings: {
    categories: [{
      id: 'clips',
      title: { 'en-US': 'Clips', 'ko-KR': '클립', 'ja-JP': 'クリップ' },
      settings: [{
        type: 'boolean',
        key: SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING,
        title: {
          'en-US': 'Play the next clip automatically',
          'ko-KR': '다음 클립 자동 재생',
          'ja-JP': '次のクリップを自動再生',
        },
        defaultValue: true,
      }],
    }],
  },
  shortFormVideo: {
    previous: true,
    next: true,
    autoAdvance: {
      settingKey: SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING,
      defaultValue: true,
    },
  },
  locale: BUILTIN_SITE_LOCALE,
  pictureInPicture: {
    // CHZZK briefly enters native PiP while leaving a live page and performs
    // player cleanup from the matching leave event. Let that internal cycle
    // complete, while keeping its page PiP button hidden from the user.
    pageRequestPolicy: 'transient',
    pageControlSelectors: CHZZK_PIP_CONTROL_SELECTORS,
  },
  menu: { category: 'Streaming', order: 10, icon: 'https://chzzk.naver.com/favicon.ico' },
  permissions: ['navigation', 'network-interception', 'script-injection'],
})
export class ChzzkProvider extends UrlProvider {
  protected readonly url = 'https://chzzk.naver.com/';
  private injectionPass = 0;
  private qualityRedirectCount = 0;
  private qualityBypassEnabled = true;
  private autoAdvanceClips = true;
  private clipsInjectionInstalled = false;

  async load(): Promise<void> {
    this.subscriptions.add(
      this.context.viewer.onFrameReady(() => this.installClipsInjection()),
    );
    await super.load();
  }

  protected async beforeLoad(): Promise<void> {
    this.qualityBypassEnabled = true;
    this.context.viewer.setUserAgent(CHZZK_BROWSER_USER_AGENT);
  }

  protected async afterLoad(): Promise<void> {
    // Keep the injections independent. A CHZZK markup change in the quality
    // enhancement must never prevent the ad skipper from being installed.
    const qualityEnhancementScript = createChzzkQualityEnhancementScript({
      enableBypassActionUrl: this.context.actions.createUrl(
        CHZZK_ENABLE_1080_BYPASS_ACTION,
      ),
      disableBypassActionUrl: this.context.actions.createUrl(
        CHZZK_DISABLE_1080_BYPASS_ACTION,
      ),
    });
    const injections = [
      ['ad response blocker', CHZZK_AD_RESPONSE_BLOCKER_SCRIPT],
      ['quality enhancement', qualityEnhancementScript],
      ['ad skipper', CHZZK_AD_SKIPPER_SCRIPT],
    ] as const;
    const results = await Promise.allSettled(
      injections.map(([, script]) =>
        this.context.viewer.executeJavaScript(script),
      ),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.context.logger.warn(
          `CHZZK ${injections[index][0]} injection failed.`,
          result.reason,
        );
      }
    });
    await this.installClipsInjection();
    this.injectionPass += 1;
    if (results.every((result) => result.status === 'fulfilled')) {
      this.context.logger.info('CHZZK page injections are active.', {
        pass: this.injectionPass,
        phase: this.injectionPass === 1 ? 'dom-ready' : 'refresh',
      });
    }
  }

  async onAction(action: string): Promise<boolean> {
    if (action === SHORT_FORM_VIDEO_ACTIONS.next) {
      await this.runClipsCommand('next');
      return true;
    }
    if (action === SHORT_FORM_VIDEO_ACTIONS.previous) {
      await this.runClipsCommand('previous');
      return true;
    }
    if (action === SHORT_FORM_VIDEO_ACTIONS.announceAutoAdvance) {
      await this.runClipsCommand('announce');
      return true;
    }
    if (action === CHZZK_ENABLE_1080_BYPASS_ACTION) {
      this.setQualityBypassEnabled(true, '1080p Kawaikara selected');
      return true;
    }
    if (action === CHZZK_DISABLE_1080_BYPASS_ACTION) {
      this.setQualityBypassEnabled(false, 'native CHZZK quality selected');
      return true;
    }
    return false;
  }

  async onSettingsChanged(settings: ProviderSettings): Promise<void> {
    this.autoAdvanceClips =
      typeof settings[SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING] === 'boolean'
        ? settings[SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING]
        : true;
    if (!this.clipsInjectionInstalled) return;
    await this.context.viewer.executeJavaScriptInAllFrames(
      createChzzkClipsInjectionScript(this.clipsOptions(false)),
    );
  }

  onBeforeRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined {
    // Do not cancel Veta CORS preflights. A failed OPTIONS request is itself
    // an anti-adblock signal and makes CHZZK show its blocker warning. Ads are
    // neutralized by the page response patch and media skipper instead.
    if (details.method !== 'GET' || !this.qualityBypassEnabled) return undefined;
    if (!isChzzk480MediaUrl(details.url)) return undefined;

    const redirectURL = details.url.replace(/480p/gi, '1080p');
    if (redirectURL === details.url) return undefined;
    this.qualityRedirectCount += 1;
    if (
      this.qualityRedirectCount === 1 ||
      this.qualityRedirectCount % 100 === 0
    ) {
      this.context.logger.info(
        'CHZZK 1080p bypass redirected the internal 480p media route.',
        {
          redirectCount: this.qualityRedirectCount,
          request: describeMediaUrl(details.url),
          redirectedTo: describeMediaUrl(redirectURL),
        },
      );
    }
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
    this.qualityBypassEnabled = false;
    this.context.viewer.setUserAgent();
    await super.unload();
  }

  private setQualityBypassEnabled(enabled: boolean, reason: string): void {
    if (this.qualityBypassEnabled === enabled) return;
    this.qualityBypassEnabled = enabled;
    this.context.logger.info(
      `CHZZK 1080p request bypass ${enabled ? 'enabled' : 'disabled'}.`,
      { reason },
    );
  }

  private async runClipsCommand(
    command: 'next' | 'previous' | 'announce',
  ): Promise<void> {
    await this.context.viewer.executeJavaScriptInAllFrames(
      createChzzkClipsCommandScript(command),
    );
  }

  private async installClipsInjection(): Promise<void> {
    const results = await this.context.viewer.executeJavaScriptInAllFrames(
      createChzzkClipsInjectionScript(this.clipsOptions(false)),
    );
    this.clipsInjectionInstalled = results.length > 0;
  }

  private clipsOptions(announce: boolean): ChzzkClipsInjectionOptions {
    return {
      autoAdvance: this.autoAdvanceClips,
      announce,
      labels: resolveClipsLabels(this.context.locale?.site),
    };
  }
}

function resolveClipsLabels(
  locale?: string,
): ChzzkClipsInjectionOptions['labels'] {
  if (locale?.toLowerCase().startsWith('ko')) {
    return {
      enabled: '클립 자동 넘김 켜짐',
      disabled: '클립 자동 넘김 꺼짐',
      next: '다음 클립',
      previous: '이전 클립',
    };
  }
  if (locale?.toLowerCase().startsWith('ja')) {
    return {
      enabled: 'クリップ自動送り オン',
      disabled: 'クリップ自動送り オフ',
      next: '次のクリップ',
      previous: '前のクリップ',
    };
  }
  return {
    enabled: 'Clip auto-advance on',
    disabled: 'Clip auto-advance off',
    next: 'Next clip',
    previous: 'Previous clip',
  };
}

function isChzzk480MediaUrl(value: string): boolean {
  if (!/480p/i.test(value) || !isChzzkRelatedUrl(value)) return false;
  try {
    const url = new URL(value);
    // The old integration rewrote every 480p media request, not only the
    // top-level m3u8. Current CHZZK players can request nested playlists and
    // segment paths carrying the quality directory, so restricting this to a
    // single .m3u8 silently falls back to the real 480p stream.
    return /(?:480p|chunklist|playlist|manifest|segment|\.m3u8|\.m4s|\.ts)/i.test(
      url.pathname,
    );
  } catch {
    return false;
  }
}

function describeMediaUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.slice(0, 240);
  } catch {
    return '<invalid-url>';
  }
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
    hostname.endsWith('.pstatic.net') ||
    hostname === 'akamaized.net' ||
    hostname.endsWith('.akamaized.net') ||
    hostname === 'ntruss.com' ||
    hostname.endsWith('.ntruss.com') ||
    hostname === 'naver.net' ||
    hostname.endsWith('.naver.net')
  );
}
