import { AbstractPlugin, plugin, defineProviderLocale, readShortFormVideoAutoAdvance,
  SHORT_FORM_VIDEO_ACTIONS, resolveShortFormVideoCommand } from '@kawaikara/site-api';
import { builtinPluginMetadata } from '../../../../Functional/PluginMetadata';
import { createChzzkClipsCommandScript, createChzzkClipsInjectionScript, type ChzzkClipsInjectionOptions } from '../../Inject/Index';
import { CHZZK_AD_BLOCKING } from '../Contracts';
import localization from '../../locale.json';
/** JSON-backed settings and page announcements. */
const messages = defineProviderLocale(localization);

/** Optional clip navigation and auto-advance. */
@plugin(builtinPluginMetadata('kawaikara.chzzk.clips', 'plugins.clips', localization, [{
  type: 'boolean', key: 'short-form-video.auto-advance', defaultValue: true,
  title: messages.text('settings.short-form-video.auto-advance.title'),
}]))
export default class ChzzkClipsPlugin extends AbstractPlugin {
  /** Effective playback preference. */
  private autoAdvanceClips = true;
  /** Read settings before registering page injections. */
  activate(): void {
    this.autoAdvanceClips = readShortFormVideoAutoAdvance(this.context.settings.get());
    this.context.settings.onChanged(async settings => {
      this.autoAdvanceClips = readShortFormVideoAutoAdvance(settings);
      await this.requirePage().refresh('chzzk.clips');
    });
    for (const action of Object.values(SHORT_FORM_VIDEO_ACTIONS)) {
      const command = resolveShortFormVideoCommand(action);
      if (command && command !== 'ban') this.context.actions.register(action, () => this.runClipsCommand(command));
    }
    this.requirePage().register({ id: 'chzzk.clips',
      source: () => createChzzkClipsInjectionScript(this.clipsOptions(false)),
      phases: ['dom-ready', 'did-finish-load', 'frame-ready'], frames: 'all' });
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
      /** Ad blocking remains independently controllable while Clips is enabled. */
      skipAdvertisements: !!this.context.capabilities.get(CHZZK_AD_BLOCKING),
      /** The announce value. */
      announce,
      /** The skip advertisement action URL value. */
      skipAdvertisementActionUrl: this.context.capabilities.get(CHZZK_AD_BLOCKING)?.skipActionUrl() ?? '',
      /** The labels value. */
      labels: resolveClipsLabels(this.context.app.locale?.site),
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
