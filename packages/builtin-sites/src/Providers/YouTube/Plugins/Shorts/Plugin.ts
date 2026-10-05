import { AbstractPlugin, plugin, defineProviderLocale, normalizeShortFormVideoPublisher,
  readShortFormVideoAutoAdvance, readShortFormVideoBannedPublishers, SHORT_FORM_VIDEO_ACTIONS,
  SHORT_FORM_PUBLISHER_CAPABILITY, resolveShortFormVideoCommand,
  type ProviderSettingListItem, type ShortFormVideoPublisher } from '@kawaikara/site-api';
import { builtinPluginMetadata } from '../../../../Functional/PluginMetadata';
import { createYouTubeShortsCommandScript, createYouTubeShortsInjectionScript,
  createYouTubeShortsPublisherScript, type YouTubeShortsInjectionOptions } from '../../Inject/Shorts';
import localization from '../../locale.json';
/** JSON-backed settings and page announcements. */
const messages = defineProviderLocale(localization);

/** Optional Shorts navigation, auto-advance and publisher filtering. */
@plugin(builtinPluginMetadata('kawaikara.youtube.shorts', 'plugins.shorts', localization, [{
  type: 'boolean', key: 'short-form-video.auto-advance', defaultValue: true,
  title: messages.text('settings.short-form-video.auto-advance.title'),
}, {
  type: 'item-list', key: 'short-form-video.banned-publishers',
  title: messages.text('settings.short-form-video.banned-publishers.title'),
  description: messages.text('settings.short-form-video.banned-publishers.description'),
  emptyText: messages.text('settings.short-form-video.banned-publishers.emptyText'),
}]))
export default class YouTubeShortsPlugin extends AbstractPlugin {
  /** Effective automatic playback preference. */
  private autoAdvanceShorts = true;
  /** Effective publisher filter. */
  private bannedPublishers: readonly ProviderSettingListItem[] = [];
  /** Register actions and a typed publisher service through the App-owned runtime. */
  activate(): void {
    const settings = this.context.settings.get();
    this.autoAdvanceShorts = readShortFormVideoAutoAdvance(settings);
    this.bannedPublishers = readShortFormVideoBannedPublishers(settings);
    this.context.settings.onChanged(async value => {
      this.autoAdvanceShorts = readShortFormVideoAutoAdvance(value);
      this.bannedPublishers = readShortFormVideoBannedPublishers(value);
      await this.requirePage().refresh('youtube.shorts');
    });
    for (const action of Object.values(SHORT_FORM_VIDEO_ACTIONS)) {
      const command = resolveShortFormVideoCommand(action);
      if (command) this.context.actions.register(action, () => this.runShortsCommand(command));
    }
    this.context.capabilities.provide(SHORT_FORM_PUBLISHER_CAPABILITY, { getPublisher: () => this.getShortFormVideoPublisher() });
    this.requirePage().register({ id: 'youtube.shorts', source: () => createYouTubeShortsInjectionScript(this.shortsOptions(false)) });
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
      labels: resolveShortsLabels(this.context.app.locale?.site),
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
