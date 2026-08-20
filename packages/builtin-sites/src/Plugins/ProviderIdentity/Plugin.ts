import { AbstractPlugin, plugin } from '@kawaikara/site-api';
import { createProviderIdentityInjectionScript } from './Inject';

@plugin({
  id: 'kawaikara.provider-identity',
  name: 'Provider Identity',
  description: 'Exposes the active Provider id to its remote document.',
})
export class ProviderIdentityPlugin extends AbstractPlugin {
  activate(): void {
    this.subscriptions.add(
      this.context.provider.viewer.onDomReady(() => this.installIdentity()),
    );
  }

  private async installIdentity(): Promise<void> {
    await this.context.provider.viewer.executeJavaScript(
      createProviderIdentityInjectionScript(
        this.context.provider.metadata.id,
      ),
    );
  }
}
