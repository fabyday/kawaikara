import {
  AbstractSiteDescriptor,
  type SiteContext,
} from '@kawaikara/site-api';

export abstract class UrlSiteDescriptor extends AbstractSiteDescriptor {
  protected abstract readonly url: string;

  constructor(context: SiteContext) {
    super(context);
  }

  async load(): Promise<void> {
    await this.beforeLoad();
    this.subscriptions.add(
      this.context.viewer.onDomReady(() => this.afterLoad()),
    );
    this.subscriptions.add(
      this.context.viewer.onDidFinishLoad(() => this.afterLoad()),
    );
    try {
      await this.context.viewer.loadURL(this.url);
    } catch (error) {
      // Some SPAs immediately replace their first document. Electron reports
      // that expected redirect as ERR_ABORTED while the final page keeps loading.
      if (!isNavigationAborted(error)) {
        throw error;
      }
      return;
    }
    // did-finish-load can race with a site's immediate redirect. Running once
    // after loadURL resolves guarantees the final document receives its hook.
    await this.afterLoad();
  }

  protected async beforeLoad(): Promise<void> {}

  protected async afterLoad(): Promise<void> {}
}

function isNavigationAborted(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_ABORTED'
  );
}
