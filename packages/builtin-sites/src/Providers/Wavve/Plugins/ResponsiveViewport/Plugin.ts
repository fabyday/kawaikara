import { AbstractPlugin, plugin } from '@kawaikara/site-api';
import { builtinPluginMetadata } from '../../../../Functional/PluginMetadata';
import { WAVVE_RESPONSIVE_VIEWPORT_SCRIPT } from '../../Inject/ResponsiveViewport';
import localization from '../../locale.json';

/** Optional page enhancement, independently managed by App. */
@plugin(builtinPluginMetadata('kawaikara.wavve.responsive-viewport', 'plugins.responsive-viewport', localization))
export default class ResponsiveViewportPlugin extends AbstractPlugin {
  /** Host disposal fences later reinjection. */
  activate(): void {
    this.requirePage().register({ id: 'ResponsiveViewport', source: WAVVE_RESPONSIVE_VIEWPORT_SCRIPT });
  }
}
