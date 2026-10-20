import { app } from 'electron';
import { writeFile } from 'node:fs/promises';
import type { ApplicationLifecycleManager } from '../../Manager/ApplicationLifecycleManager';
import type { ExternalOpenRequest } from '../External/ExternalOpen';
import type { InitializedApplication } from './ApplicationInitialization';
import { getKawaiDataPath } from './UserDataPaths';

/** Routes OS requests through the same retained video surface used by the library. */
export async function openExternalRequest(
    application: InitializedApplication,
    request: ExternalOpenRequest,
): Promise<boolean> {
    const { sites, viewerRuntime, videoLibrary } = application;
    if (request.bridgeWake) {
        viewerRuntime.viewer.focusViewer();
        app.focus({ steal: true });
        return true;
    }
    if (request.localVideoPath) {
        const result = await videoLibrary.openPath(request.localVideoPath);
        if (result.kind !== 'video') return false;
        viewerRuntime.video.queueVideoOpenRequest(result.request);
        viewerRuntime.viewer.hideOverlay();
        if (!(
            sites.isCurrentSite('kawaikara.video') &&
            viewerRuntime.video.presentQueuedVideoOpenRequest()
        )) {
            await sites.load('kawaikara.video');
        }
    } else {
        const resolved = sites.resolveAddress(request.targetUrl);
        if (!resolved) return false;
        await sites.openUrl(resolved.siteId, resolved.url);
    }
    viewerRuntime.viewer.focusViewer();
    return true;
}

/** Load the first UI/site and start services that depend on initialized managers. */
export async function postInitializeApplication(
    application: InitializedApplication,
    lifecycle: ApplicationLifecycleManager,
): Promise<void> {
    const {
        applicationLog,
        social,
        preferences,
        sites,
        updates,
        viewerRuntime,
    } = application;

    await viewerRuntime.viewer.loadOverlay();
    // On Windows, prepare the retained Video WebContentsView while the first
    // Provider loads. It stays in the Viewer across site changes.
    void viewerRuntime.video
        .prepareInternalVideoView()
        .catch((error: unknown) => {
            applicationLog.warn(
                'The Video view could not be prepared in advance.',
                error,
            );
        });
    const startupRequest = lifecycle.takeStartupRequest();
    const resolvedStartupRequest =
        startupRequest && !startupRequest.bridgeWake
            ? await openExternalRequest(application, startupRequest).catch(
                  (error: unknown) => {
                      applicationLog.warn(
                          'The startup file or URL could not be opened.',
                          error,
                      );
                      return false;
                  },
              )
            : false;
    if (!resolvedStartupRequest) {
        const configuredSite = __KAWAIKARA_UPDATE_TEST_PROFILE__
            ? 'kawaikara.video'
            : preferences.get().defaultSiteId;
        await sites.load(
            sites.has(configuredSite) ? configuredSite : 'kawaikara.youtube',
        );
    }

    if (startupRequest?.bridgeWake)
        await openExternalRequest(application, startupRequest);

    lifecycle.activateExternalOpenHandler(async (request) => {
        if (!(await openExternalRequest(application, request))) {
            applicationLog.warn(
                `No installed Provider accepts external URL: ${request.targetUrl}`,
            );
            return;
        }
    });

    if (!resolvedStartupRequest && preferences.get().openMenuOnStartup) {
        viewerRuntime.viewer.showOverlay();
    }

    if (__KAWAIKARA_UPDATE_TEST_PROFILE__) {
        // The smoke runner checks this after a real ShipIt/NSIS relaunch, not just
        // the installed bundle's version or a successful download event.
        await writeFile(
            getKawaiDataPath('update-test-runtime.json'),
            JSON.stringify({
                pid: process.pid,
                version: app.getVersion(),
                execPath: process.execPath,
                stateRoot: __KAWAIKARA_UPDATE_TEST_PROFILE__.stateRoot,
                feedUrl: __KAWAIKARA_UPDATE_TEST_PROFILE__.feedUrl,
                startedAt: new Date().toISOString(),
            }),
        );
    }
    void social.start();
    void updates.checkAtStartup();
    applicationLog.info('Application startup completed.', {
        defaultSiteId: preferences.get().defaultSiteId,
        startupRequest: Boolean(resolvedStartupRequest),
    });
}
