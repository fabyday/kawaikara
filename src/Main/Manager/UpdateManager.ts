import { app, autoUpdater as nativeAutoUpdater, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BUILD_CHANNEL,
  IS_DISTRIBUTION_BUILD,
  UPDATE_TEST_PROFILE,
  UPDATE_REPOSITORIES,
  toUpdaterChannel,
} from '../../Common/BuildConfig';
import type {
  ApplicationUpdateCheckResult,
  ApplicationUpdatePanelState,
  ApplicationUpdateProgress,
  PreferenceState,
} from '../../Common/IPC';
import {
  normalizeReleaseNotes,
  normalizeUpdateProgress,
  type ApplicationUpdateSignal,
} from '../Functional/ApplicationUpdates';
import { resolveLocalUpdateFeed } from '../Functional/LocalUpdateFeed';
import { waitForNativeUpdate, type UpdateInstallLifecycle } from '../Functional/UpdateInstallation';
import type { LoggingManager } from './LoggingManager';
import type { WindowManager } from './WindowManager';

/** Defines the shared check timeout ms constant. */
const CHECK_TIMEOUT_MS = 60_000;

/** Coordinates update behavior. */
export class UpdateManager {
  /** The update log value. */
  private readonly updateLog: ReturnType<LoggingManager['getLogger']>;
  /** The preferences value. */
  private preferences?: PreferenceState;
  /** The check request value. */
  private checkRequest?: Promise<ApplicationUpdateCheckResult>;
  /** The download request value. */
  private downloadRequest?: Promise<ApplicationUpdatePanelState>;
  /** The current state value. */
  private currentState?: ApplicationUpdatePanelState;
  /** The installing update value. */
  private installingUpdate = false;
  /** The pending preparation request, distinct from a committed installer handoff. */
  private installRequest?: Promise<void>;
  /** Retains a verified download so a recoverable installation failure need not redownload it. */
  private downloadedState?: ApplicationUpdatePanelState;
  /** Whether Squirrel has finished staging the current download. */
  private nativeUpdateReady = false;
  /** Reversible application-specific install preparation. */
  private installLifecycle?: UpdateInstallLifecycle;

  /** Creates an instance of UpdateManager. */
  constructor(
    /** The Windows value. */
    private readonly windows: WindowManager,
    logging: LoggingManager,
  ) {
    this.updateLog = logging.getLogger('updates');
    autoUpdater.logger = logging.updaterLogger;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    // Late native/proxy errors can arrive outside a check/download Promise.
    // Keep a permanent observer so EventEmitter never throws an unhandled error.
    autoUpdater.on('error', (reason: Error) => {
      this.updateLog.error('Updater error.', { message: reason.message, code: getUpdaterErrorCode(reason) });
    });
  }

  /** Connects reversible shutdown preparation after the other managers are initialized. */
  setInstallLifecycle(lifecycle: UpdateInstallLifecycle): void {
    this.installLifecycle = lifecycle;
  }

  /** Performs the configure operation. */
  configure(preferences: PreferenceState): void {
    this.preferences = preferences;
    this.applyBuildChannel();
  }

  /** Applies the build channel. */
  private applyBuildChannel(): void {
    const localFeed = resolveLocalUpdateFeed(UPDATE_TEST_PROFILE?.feedUrl ?? process.env.KAWAIKARA_LOCAL_UPDATE_URL);
    if (localFeed) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: localFeed,
        channel: toUpdaterChannel(BUILD_CHANNEL),
        useMultipleRangeRequest: false,
      });
      this.updateLog.info(`Using local ${BUILD_CHANNEL} update feed: ${localFeed}`);
    } else {
      const repository = UPDATE_REPOSITORIES[BUILD_CHANNEL];
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: repository.owner,
        repo: repository.repo,
        channel: toUpdaterChannel(BUILD_CHANNEL),
      });
    }
    autoUpdater.channel = toUpdaterChannel(BUILD_CHANNEL);
    autoUpdater.allowPrerelease = BUILD_CHANNEL !== 'stable';
    // A package can only advance inside the repository/channel it was built
    // for. Cross-channel upgrades and downgrades are intentionally disabled.
    autoUpdater.allowDowngrade = false;
  }

  /** Performs the check at startup operation. */
  async checkAtStartup(): Promise<void> {
    // Every packaged channel checks its own feed. The preference controls
    // automatic download/install, not whether the application can discover
    // and present a release at all.
    await this.checkForUpdatesInternal(
      'automatic',
      this.preferences?.automaticUpdates === true,
    );
  }

  /** Performs the check for updates operation. */
  checkForUpdates(): Promise<ApplicationUpdateCheckResult> {
    return this.checkForUpdatesInternal('manual', false);
  }

  /** Returns the state. */
  getState(): ApplicationUpdatePanelState | undefined {
    return this.currentState;
  }

  /** Determines whether the installing condition applies. */
  isInstalling(): boolean {
    return this.installingUpdate;
  }

  /** Performs the download update operation. */
  async downloadUpdate(): Promise<ApplicationUpdatePanelState> {
    if (this.downloadRequest) return this.downloadRequest;
    const state = this.currentState;
    if (!state || state.phase !== 'available') {
      throw new Error('No checked update is ready to download.');
    }

    const request = this.performDownload({ ...state, origin: 'manual' });
    this.downloadRequest = request;
    try {
      return await request;
    } finally {
      if (this.downloadRequest === request) this.downloadRequest = undefined;
    }
  }

  /** Installs the update. */
  async installUpdate(): Promise<void> {
    if (this.installRequest) return this.installRequest;
    const state = this.currentState;
    const retryable = state?.phase === 'error' && state.canRetryInstall === true;
    if (this.installingUpdate || (!retryable && state?.phase !== 'downloaded') || !this.downloadedState) return;
    const request = this.performInstallation(this.downloadedState);
    this.installRequest = request;
    try {
      await request;
    } finally {
      if (this.installRequest === request) this.installRequest = undefined;
    }
  }

  /** Validates native staging before any application resources are released. */
  private async performInstallation(downloaded: ApplicationUpdatePanelState): Promise<void> {
    const isSilent = downloaded.origin === 'automatic' && process.platform === 'win32';
    this.updateLog.info('Starting application update installation.', {
      currentVersion: downloaded.currentVersion,
      targetVersion: downloaded.latestVersion,
      channel: downloaded.channel,
      platform: process.platform,
      isSilent,
    });
    this.updateState({ ...downloaded, phase: 'preparing' });
    let preparationStarted = false;
    let failed = false;
    /** Recovers once, even when an emitted error is followed by a thrown error. */
    const fail = async (reason: unknown) => {
      if (failed) return;
      failed = true;
      this.installingUpdate = false;
      autoUpdater.off('error', onInstallError);
      const error = reason instanceof Error ? reason.message : String(reason);
      this.updateLog.error('Update installer failed to start.', error);
      if (preparationStarted) {
        await this.installLifecycle?.recover().catch((recoveryError: unknown) => {
          this.updateLog.error('Update failure recovery failed.', recoveryError);
        });
      }
      this.presentState({
        ...downloaded,
        phase: 'error',
        errorStage: 'install',
        errorCode: getUpdaterErrorCode(reason),
        error,
        canRetryInstall: getUpdaterErrorCode(reason) !== 'ERR_UPDATER_INVALID_SIGNATURE',
      });
    };
    /** Handles asynchronous installer startup errors without leaving the app disposed. */
    const onInstallError = (reason: Error) => {
      if (this.installingUpdate) void fail(reason);
    };
    try {
      if (process.platform === 'darwin' && !this.nativeUpdateReady) {
        // MacUpdater.downloadUpdate() only prepares its loopback ZIP proxy when
        // autoInstallOnAppQuit=false. Calling quitAndInstall before Squirrel is
        // ready installs a persistent native quit listener, including on failure.
        // Stage explicitly instead: failed/late events can never trigger a quit.
        await waitForNativeUpdate(nativeAutoUpdater, () => nativeAutoUpdater.checkForUpdates());
        this.nativeUpdateReady = true;
      }
      preparationStarted = true;
      await this.installLifecycle?.prepare();
      this.updateState({ ...downloaded, phase: 'installing' });
      autoUpdater.on('error', onInstallError);
      this.installingUpdate = true;
      // Only now may before-quit bypass ordinary app.exit teardown, allowing
      // Squirrel/NSIS to finish their own quit/relaunch negotiation.
      autoUpdater.quitAndInstall(isSilent, true);
    } catch (reason) {
      await fail(reason);
    }
  }

  /** Performs the check for updates internal operation. */
  private async checkForUpdatesInternal(
    origin: ApplicationUpdatePanelState['origin'],
    downloadAutomatically: boolean,
  ): Promise<ApplicationUpdateCheckResult> {
    if (this.installRequest || this.installingUpdate || this.downloadRequest || this.currentState?.phase === 'downloading') {
      throw new Error('An update is already downloading or being installed.');
    }
    if (this.checkRequest) {
      if (this.currentState?.origin === 'manual') {
        this.windows.showUpdateOverlay(this.currentState);
      }
      return this.checkRequest;
    }
    const request = this.performCheck(origin, downloadAutomatically);
    this.checkRequest = request;
    try {
      return await request;
    } finally {
      if (this.checkRequest === request) this.checkRequest = undefined;
      this.applyBuildChannel();
    }
  }

  /** Performs the perform check operation. */
  private async performCheck(
    origin: ApplicationUpdatePanelState['origin'],
    downloadAutomatically: boolean,
  ): Promise<ApplicationUpdateCheckResult> {
    const currentVersion = app.getVersion();
    const checkingState: ApplicationUpdatePanelState = {
      phase: 'checking',
      origin,
      channel: BUILD_CHANNEL,
      currentVersion,
    };
    if (origin === 'manual') {
      this.presentState(checkingState);
    } else {
      // Automatic startup checks are deliberately invisible. The update
      // overlay appears only after a newer release has actually been found.
      this.currentState = checkingState;
    }

    if (!app.isPackaged || !IS_DISTRIBUTION_BUILD) {
      const unsupported: ApplicationUpdatePanelState = {
        phase: 'unsupported',
        origin,
        channel: BUILD_CHANNEL,
        currentVersion,
      };
      this.finishCheckState(unsupported);
      return {
        /** The status value. */
        status: 'unsupported',
        /** The channel value. */
        channel: BUILD_CHANNEL,
        /** The current version value. */
        currentVersion,
      };
    }

    this.applyBuildChannel();

    try {
      const signal = await this.waitForUpdateSignal();
      const checkedState: ApplicationUpdatePanelState = {
        phase: signal.available ? 'available' : 'up-to-date',
        origin,
        channel: BUILD_CHANNEL,
        currentVersion,
        latestVersion: signal.version,
        releaseNotes: signal.releaseNotes,
      };

      if (signal.available && downloadAutomatically) {
        this.currentState = checkedState;
        await this.performDownload(checkedState, true);
      } else if (signal.available && origin === 'automatic') {
        // Users who disabled automatic installation still receive the update
        // prompt and can explicitly choose whether to download it.
        this.presentState(checkedState);
      } else {
        this.finishCheckState(checkedState);
      }

      return {
        /** The status value. */
        status: signal.available ? 'update-available' : 'up-to-date',
        /** The channel value. */
        channel: BUILD_CHANNEL,
        /** The current version value. */
        currentVersion,
        /** The latest version value. */
        latestVersion: signal.version,
      };
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      this.updateLog.error('Update check failed.', error);
      const failedState: ApplicationUpdatePanelState = {
        phase: 'error',
        origin,
        channel: BUILD_CHANNEL,
        currentVersion,
        error,
        errorStage: 'check',
        errorCode: getUpdaterErrorCode(reason),
      };
      this.finishCheckState(failedState);
      return {
        /** The status value. */
        status: 'error',
        /** The channel value. */
        channel: BUILD_CHANNEL,
        /** The current version value. */
        currentVersion,
        /** The error value. */
        error,
      };
    }
  }

  /** Waits for the for update signal. */
  private waitForUpdateSignal(): Promise<ApplicationUpdateSignal> {
    return new Promise<ApplicationUpdateSignal>((resolve, reject) => {
      let settled = false;
      /** Performs the finish operation. */
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      /** Handles the available. */
      const onAvailable = (info: {
        version: string;
        releaseNotes?: unknown;
      }) => finish(() => resolve({
        available: true,
        version: info.version,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      }));
      /** Handles the not available. */
      const onNotAvailable = (info: { version: string
      }) =>
        finish(() => resolve({ available: false, version: info.version
        }));
      /** Handles the error. */
      const onError = (error: Error) => finish(() => reject(error));
      const timer = setTimeout(
        () => finish(() => reject(new Error('Update check timed out.'))),
        CHECK_TIMEOUT_MS,
      );
      /** Performs the cleanup operation. */
      const cleanup = () => {
        clearTimeout(timer);
        autoUpdater.off('update-available', onAvailable);
        autoUpdater.off('update-not-available', onNotAvailable);
        autoUpdater.off('error', onError);
      };

      autoUpdater.once('update-available', onAvailable);
      autoUpdater.once('update-not-available', onNotAvailable);
      autoUpdater.once('error', onError);
      void autoUpdater.checkForUpdates().then((result) => {
        if (!result) {
          finish(() => reject(new Error('The updater is not available.')));
        }
      }).catch((error: unknown) => {
        finish(() => reject(error));
      });
    });
  }

  /** Performs the perform download operation. */
  private async performDownload(
    available: ApplicationUpdatePanelState,
    presentAutomatically = false,
  ): Promise<ApplicationUpdatePanelState> {
    const downloading: ApplicationUpdatePanelState = {
      ...available,
      phase: 'downloading',
      progress: {
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      },
    };
    if (presentAutomatically) {
      this.presentState(downloading);
    } else {
      this.updateState(downloading);
    }

    /** Handles the progress. */
    const onProgress = (progress: ApplicationUpdateProgress) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.setProgressBar(progress.percent / 100);
      }
      this.updateState({
        ...available,
        phase: 'downloading',
        progress: normalizeUpdateProgress(progress),
      });
    };
    autoUpdater.on('download-progress', onProgress);

    try {
      await autoUpdater.downloadUpdate();
      this.nativeUpdateReady = false;
      const total = this.currentState?.progress?.total ?? 0;
      const downloaded: ApplicationUpdatePanelState = {
        ...available,
        phase: 'downloaded',
        progress: {
          percent: 100,
          bytesPerSecond: 0,
          transferred: total,
          total,
        },
      };
      this.updateState(downloaded);
      this.downloadedState = downloaded;
      if (available.origin === 'automatic') {
        // Automatic updates are opt-in. Once the opted-in download completes,
        // briefly publish the completed state and restart into the new build.
        setTimeout(() => {
          if (this.currentState === downloaded) void this.installUpdate();
        }, 750);
      }
      return downloaded;
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      this.updateLog.error('Update download failed.', error);
      const failed: ApplicationUpdatePanelState = {
        ...available,
        phase: 'error',
        error,
        errorStage: 'download',
        errorCode: getUpdaterErrorCode(reason),
      };
      this.updateState(failed);
      return failed;
    } finally {
      autoUpdater.off('download-progress', onProgress);
      for (const window of BrowserWindow.getAllWindows()) {
        window.setProgressBar(-1);
      }
    }
  }

  /** Performs the present state operation. */
  private presentState(state: ApplicationUpdatePanelState): void {
    this.currentState = state;
    this.recordTestState(state);
    this.windows.showUpdateOverlay(state);
  }

  /** Updates the state. */
  private updateState(state: ApplicationUpdatePanelState): void {
    this.currentState = state;
    this.recordTestState(state);
    this.windows.updateUpdateOverlay(state);
  }

  /** Exposes test-only phase diagnostics without adding a production IPC/debug endpoint. */
  private recordTestState(state: ApplicationUpdatePanelState): void {
    if (!UPDATE_TEST_PROFILE) return;
    try {
      writeFileSync(path.join(UPDATE_TEST_PROFILE.stateRoot, 'KawaiData/update-test-status.json'), JSON.stringify({
        ...state,
        pid: process.pid,
        updatedAt: new Date().toISOString(),
      }));
    } catch (reason) {
      this.updateLog.error('Could not write local update-test diagnostics.', reason);
    }
  }

  /** Performs the finish check state operation. */
  private finishCheckState(state: ApplicationUpdatePanelState): void {
    if (state.origin === 'manual') {
      this.updateState(state);
      return;
    }
    // No update (or a startup check failure) must not steal focus with an
    // update panel. Keep the result available for diagnostics only.
    this.currentState = state;
  }
}

/** Returns the updater's machine-readable error code when present. */
function getUpdaterErrorCode(reason: unknown): string | undefined {
  if (!reason || typeof reason !== 'object') return undefined;
  if ('code' in reason && typeof reason.code === 'string') return reason.code;
  // Electron's Squirrel error event exposes only the localized message, not
  // NSError's domain/code. Recognize its explicit code-signature failure so
  // the panel doesn't offer a doomed cached-install retry on macOS either.
  if ('message' in reason && typeof reason.message === 'string'
    && /code signature.*(?:did not pass validation|could not|invalid)|failed to satisfy specified code requirement/i.test(reason.message)) {
    return 'ERR_UPDATER_INVALID_SIGNATURE';
  }
  return undefined;
}
