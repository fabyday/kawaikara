import type { ApplicationLifecycleManager } from '../Manager/ApplicationLifecycleManager';
import type { InitializedApplication } from './ApplicationInitialization';
import { app } from 'electron';
import { writeFile } from 'node:fs/promises';
import { UPDATE_TEST_PROFILE } from '../../Common/BuildConfig';
import { getKawaiDataPath } from './UserDataPaths';
import type { ExternalOpenRequest } from './ExternalOpen';

/** Routes OS requests through the same retained video surface used by the library. */
export async function openExternalRequest(
  application: InitializedApplication,
  request: ExternalOpenRequest,
): Promise<boolean> {
  const { sites, windows, videoLibrary } = application;
  if (request.localVideoPath) {
    const result = await videoLibrary.openPath(request.localVideoPath);
    if (result.kind !== 'video') return false;
    windows.queueVideoOpenRequest(result.request);
    windows.hideOverlay();
    if (!(sites.isCurrentSite('kawaikara.video') && windows.presentQueuedVideoOpenRequest())) {
      await sites.load('kawaikara.video');
    }
  } else {
    const resolved = sites.resolveAddress(request.targetUrl);
    if (!resolved) return false;
    await sites.openUrl(resolved.siteId, resolved.url);
  }
  windows.focusViewer();
  return true;
}

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
  // On Windows, prepare the retained Video WebContentsView while the first
  // Provider loads. It stays in the Viewer across site changes.
  void windows.prepareInternalVideoView().catch((error: unknown) => {
    applicationLog.warn('The Video view could not be prepared in advance.', error);
  });
  const startupRequest = lifecycle.takeStartupRequest();
  const resolvedStartupRequest = startupRequest
    ? await openExternalRequest(application, startupRequest).catch((error: unknown) => {
      applicationLog.warn('The startup file or URL could not be opened.', error);
      return false;
    })
    : false;
  if (!resolvedStartupRequest) {
    const configuredSite = UPDATE_TEST_PROFILE ? 'kawaikara.video' : preferences.get().defaultSiteId;
    await sites.load(
      sites.has(configuredSite) ? configuredSite : 'kawaikara.youtube',
    );
  }

  lifecycle.activateExternalOpenHandler(async (request) => {
    if (!await openExternalRequest(application, request)) {
      applicationLog.warn(
        `No installed Provider accepts external URL: ${request.targetUrl}`,
      );
      return;
    }
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
