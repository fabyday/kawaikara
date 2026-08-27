import {
  AbstractUrlProvider,
  defineProviderLocale,
  provider,
  readShortFormVideoAutoAdvance,
  resolveShortFormVideoCommand,
  type ProviderSettings,
  type NewWindowPolicy,
  type SiteRequestDetails,
  type SiteRequestRedirect,
  webAuthenticationPolicy,
  matchesSiteUrlHost,
} from '@kawaikara/site-api';
import {
  CHZZK_AD_RESPONSE_BLOCKER_SCRIPT,
  CHZZK_AD_SKIPPER_SCRIPT,
  createChzzkClipsCommandScript,
  createChzzkClipsInjectionScript,
  createChzzkQualityEnhancementScript,
  type ChzzkClipsInjectionOptions,
} from './Inject/Index';
import localization from './locale.json';

/** Stores the messages value. */
const messages = defineProviderLocale(localization);

/** Defines the shared CHZZK enable 1080 bypass action constant. */
const CHZZK_ENABLE_1080_BYPASS_ACTION = 'chzzk:quality:enable-1080';
/** Defines the shared CHZZK enable 720 bypass action constant. */
const CHZZK_ENABLE_720_BYPASS_ACTION = 'chzzk:quality:enable-720';
/** Defines the shared CHZZK disable 1080 bypass action constant. */
const CHZZK_DISABLE_1080_BYPASS_ACTION = 'chzzk:quality:disable-1080';
/** Defines the shared CHZZK skip shorts advertisement action constant. */
const CHZZK_SKIP_SHORTS_ADVERTISEMENT_ACTION = 'chzzk:clips:skip-advertisement';

/** Implements the CHZZK site provider. */
@provider({
  settings: {
    categories: [
      {
        id: 'clips',
        settings: [
          {
            type: 'boolean',
            key: 'short-form-video.auto-advance',
            defaultValue: true,
          },
        ],
      },
    ],
  },
  pictureInPicture: {
    pageRequestPolicy: 'allow',
    pageControlSelectors: [
      '.pzp-pc-pip-button',
      '.pzp-pc__pip-button',
      '.pzp-pc-ui-button[aria-label="PIP" i]',
      '.pzp-pc__setting-button[aria-label="PIP" i]',
      'button[label="PIP" i]',
    ],
    contentOverlaySelectors: [
      '.pzp-pc__subtitle',
      '.pzp-pc-subtitle',
      '.pzp-pc__caption',
    ],
  },
})
export class ChzzkProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://chzzk.naver.com/';
  /** The quality redirect count value. */
  private qualityRedirectCount = 0;
  /** The quality bypass target value. */
  private qualityBypassTarget: '720p' | '1080p' | undefined = '1080p';
  /** The auto advance clips value. */
  private autoAdvanceClips = true;
  /** The clips injection installed value. */
  private clipsInjectionInstalled = false;

  /** Loads the operation. */
  async load(): Promise<void> {
    const page = this.requirePage();
    this.subscriptions.add(page.register({
      id: 'chzzk.quality-enhancement',
      source: () => createChzzkQualityEnhancementScript({
        enableBypassActionUrl: this.context.actions.createUrl(
          CHZZK_ENABLE_1080_BYPASS_ACTION,
        ),
        enable720BypassActionUrl: this.context.actions.createUrl(
          CHZZK_ENABLE_720_BYPASS_ACTION,
        ),
        disableBypassActionUrl: this.context.actions.createUrl(
          CHZZK_DISABLE_1080_BYPASS_ACTION,
        ),
      }),
    }));
    this.subscriptions.add(page.register({
      id: 'chzzk.ad-response-blocker',
      source: CHZZK_AD_RESPONSE_BLOCKER_SCRIPT,
      phases: ['dom-ready', 'did-finish-load', 'frame-ready'],
      frames: 'all',
    }));
    this.subscriptions.add(page.register({
      id: 'chzzk.ad-skipper',
      source: CHZZK_AD_SKIPPER_SCRIPT,
      phases: ['dom-ready', 'did-finish-load', 'frame-ready'],
      frames: 'all',
    }));
    this.subscriptions.add(page.register({
      id: 'chzzk.clips',
      source: () => createChzzkClipsInjectionScript(this.clipsOptions(false)),
      phases: ['dom-ready', 'did-finish-load', 'frame-ready'],
      frames: 'all',
    }));
    this.clipsInjectionInstalled = true;
    await super.load();
  }

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    // Match the original integration: the internal 480p player route is
    // upgraded to 1080p from the first request. The page injection can later
    // switch this target to 720p or disable it for a native low-quality row.
    this.qualityBypassTarget = '1080p';
    this.qualityRedirectCount = 0;
  }

  /** Handles the action. */
  async onAction(action: string): Promise<boolean> {
    const shortFormCommand = resolveShortFormVideoCommand(action);
    if (shortFormCommand && shortFormCommand !== 'ban') {
      await this.runClipsCommand(shortFormCommand);
      return true;
    }
    if (action === CHZZK_SKIP_SHORTS_ADVERTISEMENT_ACTION) {
      this.context.logger.info(
        'Skipping a NAVER-labelled CHZZK Shorts advertisement.',
      );
      this.requirePage().sendKeyPress('ArrowDown');
      return true;
    }
    if (action === CHZZK_ENABLE_1080_BYPASS_ACTION) {
      this.setQualityBypassTarget('1080p', '1080p Kawaikara selected');
      return true;
    }
    if (action === CHZZK_ENABLE_720_BYPASS_ACTION) {
      this.setQualityBypassTarget('720p', '720p Kawaikara selected');
      return true;
    }
    if (action === CHZZK_DISABLE_1080_BYPASS_ACTION) {
      this.setQualityBypassTarget(undefined, 'native CHZZK quality selected');
      return true;
    }
    return false;
  }

  /** Handles the settings changed. */
  async onSettingsChanged(settings: ProviderSettings): Promise<void> {
    this.autoAdvanceClips = readShortFormVideoAutoAdvance(settings);
    if (!this.clipsInjectionInstalled) return;
    await this.requirePage().refresh('chzzk.clips');
  }

  /** Handles the before request. */
  onBeforeRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined {
    // The August 2026 CHZZK player no longer obtains every preroll from its
    // encrypted /service/t schedule. Google IMA now requests a VAST document
    // directly from gampad/ads. The recorded HAR proves that request returned
    // 200 immediately before the ad player was mounted. Cancel only the VAST
    // GET; Veta OPTIONS preflights remain untouched because rejecting those is
    // an anti-adblock signal on CHZZK.
    if (
      details.method === 'GET' &&
      /^https:\/\/(?:pubads|securepubads|googleads)\.(?:g\.)?doubleclick\.net\/gampad\/ads(?:[?#]|$)/i
        .test(details.url)
    ) {
      this.context.logger.info('Blocked a CHZZK Google IMA VAST ad request.');
      return {
        /** Whether the cancel option is enabled. */
        cancel: true,
      };
    }

    // Do not cancel Veta CORS preflights. A failed OPTIONS request is itself
    // an anti-adblock signal and makes CHZZK show its blocker warning. Ads are
    // neutralized by the page response patch and media skipper instead.
    if (details.method !== 'GET' || !this.qualityBypassTarget) return undefined;
    // Keep this deliberately equivalent to the proven main-branch bypass.
    // CHZZK moves media between CDN families, so host/path allowlists can
    // silently miss the playlist that actually carries the 480p route.
    if (!details.url.includes('480p')) return undefined;

    const redirectURL = details.url.replace('480p', this.qualityBypassTarget);
    if (redirectURL === details.url) return undefined;
    this.qualityRedirectCount += 1;
    if (
      this.qualityRedirectCount === 1 ||
      this.qualityRedirectCount % 100 === 0
    ) {
      this.context.logger.info(
        'CHZZK quality bypass redirected the internal 480p media route.',
        {
          target: this.qualityBypassTarget,
          redirectCount: this.qualityRedirectCount,
          request: describeMediaUrl(details.url),
          redirectedTo: describeMediaUrl(redirectURL),
        },
      );
    }
    return {
      /** The redirect URL value. */
      redirectURL,
    };
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

  /** Performs the unload operation. */
  async unload(): Promise<void> {
    this.qualityBypassTarget = undefined;
    await super.unload();
  }

  /** Sets the quality bypass target. */
  private setQualityBypassTarget(
    target: '720p' | '1080p' | undefined,
    reason: string,
  ): void {
    if (this.qualityBypassTarget === target) return;
    this.qualityBypassTarget = target;
    this.qualityRedirectCount = 0;
    this.context.logger.info(
      `CHZZK quality request bypass ${target ? `enabled for ${target}` : 'disabled'}.`,
      { reason, target: target ?? null
      },
    );
  }

  /** Runs the clips command. */
  private async runClipsCommand(
    command: 'next' | 'previous' | 'announce',
  ): Promise<void> {
    const results = await this.requirePage().executeInAllFrames<boolean>(
      'chzzk.clips.command',
      createChzzkClipsCommandScript(command),
    );
    if (
      !results.some((handled) => handled) &&
      (command === 'next' || command === 'previous')
    ) {
      // Advertisement renderers occasionally replace both the active video
      // and the visible carousel controls. A trusted key press is the final
      // site-native fallback; synthetic KeyboardEvents are ignored.
      this.requirePage().sendKeyPress(
        command === 'next' ? 'ArrowDown' : 'ArrowUp',
      );
    }
  }

  /** Performs the clips options operation. */
  private clipsOptions(announce: boolean): ChzzkClipsInjectionOptions {
    return {
      /** The auto advance value. */
      autoAdvance: this.autoAdvanceClips,
      /** The announce value. */
      announce,
      /** The skip advertisement action URL value. */
      skipAdvertisementActionUrl: this.context.actions.createUrl(
        CHZZK_SKIP_SHORTS_ADVERTISEMENT_ACTION,
      ),
      /** The labels value. */
      labels: resolveClipsLabels(this.context.locale?.site),
    };
  }

}

/** Resolves the clips labels. */
function resolveClipsLabels(
  locale?: string,
): ChzzkClipsInjectionOptions['labels'] {
  return {
    /** Whether the enabled option is enabled. */
    enabled: messages.resolve(locale, 'clips.announcement.enabled'),
    /** The disabled value. */
    disabled: messages.resolve(locale, 'clips.announcement.disabled'),
    /** The next value. */
    next: messages.resolve(locale, 'clips.announcement.next'),
    /** The previous value. */
    previous: messages.resolve(locale, 'clips.announcement.previous'),
  };
}

/** Performs the describe media URL operation. */
function describeMediaUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.slice(0, 240);
  } catch {
    return '<invalid-url>';
  }
}
