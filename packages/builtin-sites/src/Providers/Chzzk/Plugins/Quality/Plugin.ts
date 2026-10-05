import { AbstractPlugin, plugin, type SiteRequestDetails, type SiteRequestRedirect } from '@kawaikara/site-api';
import { builtinPluginMetadata } from '../../../../Functional/PluginMetadata';
import { createChzzkQualityEnhancementScript } from '../../Inject/Index';
import localization from '../../locale.json';

/** Optional quality rewriting and player quality menu integration. */
@plugin(builtinPluginMetadata('kawaikara.chzzk.quality', 'plugins.quality-enhancement', localization))
export default class ChzzkQualityPlugin extends AbstractPlugin {
  /** Preserve the initial 1080p behavior. */
  private qualityBypassTarget: '720p' | '1080p' | undefined = '1080p';
  /** Rate-limit repeated request diagnostics. */
  private qualityRedirectCount = 0;
  /** Host owns registration, ordering, and revocation. */
  activate(): void {
    if (!this.context.network) throw new Error('Quality enhancement requires network-interception.');
    this.context.network.onBeforeRequest(details => this.onBeforeRequest(details));
    this.context.actions.register('chzzk:quality:enable-1080', () => this.setQualityBypassTarget('1080p', '1080p selected'));
    this.context.actions.register('chzzk:quality:enable-720', () => this.setQualityBypassTarget('720p', '720p selected'));
    this.context.actions.register('chzzk:quality:disable-1080', () => this.setQualityBypassTarget(undefined, 'native quality selected'));
    this.requirePage().register({ id: 'quality-enhancement', source: () => createChzzkQualityEnhancementScript({
      enableBypassActionUrl: this.context.actions.createUrl('chzzk:quality:enable-1080'),
      enable720BypassActionUrl: this.context.actions.createUrl('chzzk:quality:enable-720'),
      disableBypassActionUrl: this.context.actions.createUrl('chzzk:quality:disable-1080'),
    }) });
  }
  /** Site-specific rewrite policy; Electron interception stays in App. */
  private onBeforeRequest(details: SiteRequestDetails): SiteRequestRedirect | undefined {
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
      this.context.app.logger.info(
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


  /** Sets the quality bypass target. */
  private setQualityBypassTarget(
    target: '720p' | '1080p' | undefined,
    reason: string,
  ): void {
    if (this.qualityBypassTarget === target) return;
    this.qualityBypassTarget = target;
    this.qualityRedirectCount = 0;
    this.context.app.logger.info(
      `CHZZK quality request bypass ${target ? `enabled for ${target}` : 'disabled'}.`,
      { reason, target: target ?? null
      },
    );
  }

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
