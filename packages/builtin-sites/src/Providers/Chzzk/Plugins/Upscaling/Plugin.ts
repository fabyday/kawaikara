import { AbstractPlugin, plugin, defineProviderLocale, VIDEO_CONTENT, type Disposable } from '@kawaikara/site-api';
import localization from '../../locale.json';
import engines from './Generated/engines.json';

/** Main-resolved Bundle translations; no Renderer-owned labels. */
const messages = defineProviderLocale(localization);

/** Optional live/VOD processing. Selection never mutates original playback or App site policy. */
@plugin({
  id: 'kawaikara.chzzk.upscaling',
  activation: {
    type: 'boolean', key: 'plugins.upscaling', defaultValue: false, reloadOnChange: false,
    title: messages.text('settings.plugins.upscaling.title'),
    description: messages.text('settings.plugins.upscaling.description'),
  },
  settings: [{
    type: 'select', key: 'upscaling.engine', defaultValue: 'anime4k', reloadOnChange: false,
    title: messages.text('settings.upscaling.engine.title'),
    description: messages.text('settings.upscaling.engine.description'),
    options: (['anime4k', 'websr', 'fsr1', 'realesrgan'] as const).map(value => ({
      value, label: messages.text(`settings.upscaling.engine.${value}`),
    })),
  }, {
    type: 'select', key: 'upscaling.anime4k.restore', defaultValue: 'soft', reloadOnChange: false,
    title: messages.text('settings.upscaling.restore.title'),
    description: messages.text('settings.upscaling.restore.description'),
    options: (['off', 'soft', 'detail', 'strong'] as const).map(value => ({
      value, label: messages.text(`settings.upscaling.restore.${value}`),
    })),
  }, {
    type: 'select', key: 'upscaling.anime4k.denoise', defaultValue: 'light', reloadOnChange: false,
    title: messages.text('settings.upscaling.denoise.title'),
    description: messages.text('settings.upscaling.denoise.description'),
    options: (['off', 'light', 'medium'] as const).map(value => ({
      value, label: messages.text(`settings.upscaling.denoise.${value}`),
    })),
  }, {
    type: 'select', key: 'upscaling.anime4k.quality', defaultValue: 'high', reloadOnChange: false,
    title: messages.text('settings.upscaling.quality.title'),
    description: messages.text('settings.upscaling.quality.description'),
    options: (['balanced', 'high'] as const).map(value => ({
      value, label: messages.text(`settings.upscaling.quality.${value}`),
    })),
  }, {
    type: 'select', key: 'upscaling.fsr1.sharpness', defaultValue: 'normal', reloadOnChange: false,
    title: messages.text('settings.upscaling.sharpness.title'),
    description: messages.text('settings.upscaling.sharpness.description'),
    options: (['soft', 'normal', 'strong'] as const).map(value => ({
      value, label: messages.text(`settings.upscaling.sharpness.${value}`),
    })),
  }],
})
export default class ChzzkUpscalingPlugin extends AbstractPlugin {
  /** Exactly one active effect registration for this Plugin. */
  private registration?: Disposable;
  /** Unrelated Provider settings must not recompile this effect. */
  private configuration = '';
  /** Register settings observation without site reload. */
  activate(): void {
    this.apply();
    this.context.settings.onChanged(() => this.apply());
  }
  /** App-owned disposable removes GPU work even after Plugin authority is revoked. */
  async deactivate(): Promise<void> { this.registration?.dispose(); this.registration = undefined; this.configuration = ''; }
  /** Plugin decides eligible content; App only receives an eligible video resolver. */
  private apply(): void {
    const content = this.context.capabilities.get(VIDEO_CONTENT);
    const effects = this.context.app.videoEffects;
    if (!content || !effects) {
      this.registration?.dispose(); this.registration = undefined; this.configuration = '';
      this.context.app.logger.debug('Video upscaling unavailable: Provider content or App effect capability missing.');
      return;
    }
    const settings = this.context.settings.get();
    const selected = settings['upscaling.engine'];
    const engine = typeof selected === 'string' && Object.hasOwn(engines, selected) ? selected as keyof typeof engines : 'anime4k';
    const restore = settings['upscaling.anime4k.restore'];
    const denoise = settings['upscaling.anime4k.denoise'];
    const sharpness = settings['upscaling.fsr1.sharpness'];
    const options: Record<string, string> | undefined = engine === 'anime4k' ? {
      restore: restore === 'off' || restore === 'detail' || restore === 'strong' ? restore : 'soft',
      denoise: denoise === 'off' || denoise === 'medium' ? denoise : 'light',
      quality: settings['upscaling.anime4k.quality'] === 'balanced' ? 'balanced' : 'high',
    } : engine === 'fsr1' ? { sharpness: sharpness === 'soft' || sharpness === 'strong' ? sharpness : 'normal' } : undefined;
    const resolver = content.resolver();
    const configuration = JSON.stringify([engine, options, resolver]);
    if (this.registration && this.configuration === configuration) return;
    this.registration?.dispose(); this.registration = undefined;
    this.context.app.logger.debug('Video upscaling configuration.', { engine, ...options });
    this.registration = effects.register({
      id: `upscaler.${engine}`,
      resolveVideo: `() => { const content = (${resolver})(); return content && ['live','vod'].includes(content.kind) ? content.video : null; }`,
      factory: { gzipBase64: engines[engine], execution: 'worker', scale: engine === 'realesrgan' ? 4 : 2 },
      options,
    });
    this.configuration = configuration;
  }
}
