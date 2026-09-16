import type { ApplicationLifecycleManager } from '../Manager/ApplicationLifecycleManager';
import type { InitializedApplication } from './ApplicationInitialization';
import { app } from 'electron';
import { writeFile } from 'node:fs/promises';
import { UPDATE_TEST_PROFILE } from '../../Common/BuildConfig';
import { getKawaiDataPath } from './UserDataPaths';

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
  // Windows hosts Video in a persistent owned BrowserWindow so libmpv can
  // retain its session across Provider changes. Start that renderer while the
  // initial Provider is loading; creating it only after the user clicks Video
  // exposes the native black backing surface for the whole startup interval.
  void windows.prepareInternalVideoView().catch((error: unknown) => {
    applicationLog.warn('The Video view could not be prepared in advance.', error);
  });
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
    const configuredSite = UPDATE_TEST_PROFILE ? 'kawaikara.video' : preferences.get().defaultSiteId;
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

  if (UPDATE_TEST_PROFILE) {
    // The smoke runner checks this after a real ShipIt/NSIS relaunch, not just
    // the installed bundle's version or a successful download event.
    await writeFile(getKawaiDataPath('update-test-runtime.json'), JSON.stringify({
      pid: process.pid,
      version: app.getVersion(),
      execPath: process.execPath,
      stateRoot: UPDATE_TEST_PROFILE.stateRoot,
      feedUrl: UPDATE_TEST_PROFILE.feedUrl,
      startedAt: new Date().toISOString(),
    }));
  }
  void discordPresence.start();
  void updates.checkAtStartup();
  applicationLog.info('Application startup completed.', {
    defaultSiteId: preferences.get().defaultSiteId,
    startupRequest: Boolean(resolvedStartupRequest),
  });
}
