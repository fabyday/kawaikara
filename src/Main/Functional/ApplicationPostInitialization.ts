import type { ApplicationLifecycleManager } from '../Manager/ApplicationLifecycleManager';
import type { InitializedApplication } from './ApplicationInitialization';

/** Load the first UI/site and start services that depend on initialized managers. */
export async function postInitializeApplication(
  application: InitializedApplication,
  lifecycle: ApplicationLifecycleManager,
): Promise<void> {
  const {
    applicationLog,
    discordPresence,
    preferences,
    sites,
    updates,
    windows,
  } = application;

  await windows.loadOverlay();
  const startupRequest = lifecycle.takeStartupRequest();
  const resolvedStartupRequest = startupRequest
    ? sites.resolveAddress(startupRequest.targetUrl)
    : undefined;
  if (resolvedStartupRequest) {
    await sites.openUrl(
      resolvedStartupRequest.siteId,
      resolvedStartupRequest.url,
    );
    windows.focusViewer();
  } else {
    const configuredSite = preferences.get().defaultSiteId;
    await sites.load(
      sites.has(configuredSite) ? configuredSite : 'kawaikara.youtube',
    );
  }

  lifecycle.activateExternalOpenHandler(async (request) => {
    const resolved = sites.resolveAddress(request.targetUrl);
    if (!resolved) {
      applicationLog.warn(
        `No installed Provider accepts external URL: ${request.targetUrl}`,
      );
      return;
    }
    await sites.openUrl(resolved.siteId, resolved.url);
    windows.focusViewer();
  });

  if (!resolvedStartupRequest && preferences.get().openMenuOnStartup) {
    windows.showOverlay();
  }

  void discordPresence.start();
  void updates.checkAtStartup();
  applicationLog.info('Application startup completed.', {
    defaultSiteId: preferences.get().defaultSiteId,
    startupRequest: Boolean(resolvedStartupRequest),
  });
}
