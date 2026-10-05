import { AbstractPlugin, plugin } from '@kawaikara/site-api';
import { builtinPluginMetadata } from '../../../../Functional/PluginMetadata';
import { CHZZK_AD_RESPONSE_BLOCKER_SCRIPT, CHZZK_AD_SKIPPER_SCRIPT } from '../../Inject/Index';
import { CHZZK_AD_BLOCKING } from '../Contracts';
import localization from '../../locale.json';

/** Optional request blocking, page patches and clip advertisement fallback. */
@plugin(builtinPluginMetadata('kawaikara.chzzk.ad-block', 'plugins.ad-blocking', localization))
export default class ChzzkAdBlockPlugin extends AbstractPlugin {
  /** Every registration is owned and automatically revoked by App. */
  activate(): void {
    const page = this.requirePage();
    if (!this.context.network) throw new Error('Ad blocking requires network-interception.');
    this.context.network.onBeforeRequest(details => {
      if (details.method === 'GET' && /^https:\/\/(?:pubads|securepubads|googleads)\.(?:g\.)?doubleclick\.net\/gampad\/ads(?:[?#]|$)/i.test(details.url)) {
        this.context.app.logger.info('Blocked a CHZZK Google IMA VAST ad request.');
        return { cancel: true };
      }
      return undefined;
    }, 100);
    this.context.actions.register('chzzk:clips:skip-advertisement', () => page.sendKeyPress('ArrowDown'));
    this.context.capabilities.provide(CHZZK_AD_BLOCKING, {
      skipActionUrl: () => this.context.actions.createUrl('chzzk:clips:skip-advertisement'),
    });
    page.register({ id: 'response-blocker', source: CHZZK_AD_RESPONSE_BLOCKER_SCRIPT,
      phases: ['dom-ready', 'did-finish-load', 'frame-ready'], frames: 'all' });
    page.register({ id: 'ad-skipper', source: CHZZK_AD_SKIPPER_SCRIPT,
      phases: ['dom-ready', 'did-finish-load', 'frame-ready'], frames: 'all' });
  }
}
