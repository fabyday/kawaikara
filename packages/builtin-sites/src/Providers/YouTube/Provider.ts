import {
  AbstractUrlProvider,
  defineProviderLocale,
  normalizeShortFormVideoPublisher,
  readShortFormVideoAutoAdvance,
  readShortFormVideoBannedPublishers,
  resolveShortFormVideoCommand,
  provider,
  matchesSiteUrlHost,
  type NewWindowPolicy,
  type ProviderSettingListItem,
  type ProviderSettings,
  type ShortFormVideoPublisher,
} from '@kawaikara/site-api';
import { repairIncompleteGoogleSession } from '../Google/SessionRepair';
import {
  createYouTubeShortsCommandScript,
  createYouTubeShortsInjectionScript,
  createYouTubeShortsPublisherScript,
  type YouTubeShortsInjectionOptions,
} from './Inject/Shorts';
import localization from './locale.json';

/** Stores the messages value. */
const messages = defineProviderLocale(localization);

/** Implements the you tube site provider. */
@provider({
  settings: {
    categories: [
      {
        id: 'shorts',
        settings: [
          {
            type: 'boolean',
            key: 'short-form-video.auto-advance',
            defaultValue: true,
          },
          {
            type: 'item-list',
            key: 'short-form-video.banned-publishers',
          },
        ],
      },
    ],
  },
  pictureInPicture: {
    contentOverlaySelectors: [
      '.ytp-caption-window-container',
      '.ytp-caption-window-bottom',
      '.caption-window',
      '.ytp-caption-segment',
    ],
  },
})
export class YouTubeProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://www.youtube.com/';
  /** The auto advance shorts value. */
  private autoAdvanceShorts = true;
  /** The banned publishers value. */
  private bannedPublishers: readonly ProviderSettingListItem[] = [];
  /** The injection installed value. */
  private injectionInstalled = false;

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    await repairIncompleteGoogleSession(this.context);
    this.subscriptions.add(this.requirePage().register({
      id: 'youtube.shorts',
      source: () => createYouTubeShortsInjectionScript(this.shortsOptions(false)),
    }));
    this.injectionInstalled = true;
  }

  /** Handles the settings changed. */
  async onSettingsChanged(settings: ProviderSettings): Promise<void> {
    this.autoAdvanceShorts = readShortFormVideoAutoAdvance(settings);
    this.bannedPublishers = readShortFormVideoBannedPublishers(settings);
    if (!this.injectionInstalled) return;
    await this.requirePage().refresh('youtube.shorts');
  }

  /** Returns the short form video publisher. */
  async getShortFormVideoPublisher(): Promise<
    ShortFormVideoPublisher | undefined
  > {
    const value = await this.requirePage().execute('youtube.shorts.publisher',
      createYouTubeShortsPublisherScript(),
    ) as unknown;
    return normalizeShortFormVideoPublisher(value);
  }

  /** Handles the action. */
  async onAction(action: string): Promise<boolean> {
    const command = resolveShortFormVideoCommand(action);
    if (!command) return false;
    await this.runShortsCommand(command);
    return true;
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

  /** Performs the unload operation. */
  async unload(): Promise<void> {
    this.injectionInstalled = false;
    await super.unload();
  }

  /** Runs the shorts command. */
  private async runShortsCommand(
    command: 'next' | 'previous' | 'announce' | 'ban',
  ): Promise<void> {
    const handled = await this.requirePage().execute<boolean>('youtube.shorts.command',
      createYouTubeShortsCommandScript(command),
    );
    if (!handled && (command === 'next' || command === 'previous')) {
      this.requirePage().sendKeyPress(
        command === 'next' ? 'ArrowDown' : 'ArrowUp',
      );
    }
  }

  /** Performs the shorts options operation. */
  private shortsOptions(announce: boolean): YouTubeShortsInjectionOptions {
    return {
      /** The auto advance value. */
      autoAdvance: this.autoAdvanceShorts,
      /** The banned publishers value. */
      bannedPublishers: this.bannedPublishers,
      /** The announce value. */
      announce,
      /** The labels value. */
      labels: resolveShortsLabels(this.context.locale?.site),
    };
  }
}

/** Resolves the shorts labels. */
function resolveShortsLabels(
  locale?: string,
): YouTubeShortsInjectionOptions['labels'] {
  return {
    /** Whether the enabled option is enabled. */
    enabled: messages.resolve(locale, 'shorts.announcement.enabled'),
    /** The disabled value. */
    disabled: messages.resolve(locale, 'shorts.announcement.disabled'),
    /** The banned value. */
    banned: messages.resolve(locale, 'shorts.announcement.banned'),
    /** The next value. */
    next: messages.resolve(locale, 'shorts.announcement.next'),
    /** The previous value. */
    previous: messages.resolve(locale, 'shorts.announcement.previous'),
  };
}
