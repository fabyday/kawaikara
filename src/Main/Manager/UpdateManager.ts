import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import {
  BUILD_CHANNEL,
  UPDATE_REPOSITORIES,
  toUpdaterChannel,
} from '../../Common/BuildConfig';
import type {
  ApplicationUpdateCheckResult,
  ApplicationUpdatePanelState,
  ApplicationUpdateProgress,
  PreferenceState,
} from '../../Common/IPC';
import { createLogger } from '../Logging';
import type { WindowManager } from './WindowManager';

const CHECK_TIMEOUT_MS = 60_000;
const updateLog = createLogger('updates');

interface UpdateSignal {
  readonly available: boolean;
  readonly version: string;
  readonly releaseNotes?: string;
}

export class UpdateManager {
  private preferences?: PreferenceState;
  private checkRequest?: Promise<ApplicationUpdateCheckResult>;
  private downloadRequest?: Promise<ApplicationUpdatePanelState>;
  private currentState?: ApplicationUpdatePanelState;
  private installingUpdate = false;

  constructor(private readonly windows: WindowManager) {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
  }

  configure(preferences: PreferenceState): void {
    this.preferences = preferences;
    this.applyBuildChannel();
  }

  private applyBuildChannel(): void {
    const repository = UPDATE_REPOSITORIES[BUILD_CHANNEL];
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: repository.owner,
      repo: repository.repo,
      channel: toUpdaterChannel(BUILD_CHANNEL),
    });
    autoUpdater.channel = toUpdaterChannel(BUILD_CHANNEL);
    autoUpdater.allowPrerelease = BUILD_CHANNEL !== 'stable';
    // A package can only advance inside the repository/channel it was built
    // for. Cross-channel upgrades and downgrades are intentionally disabled.
    autoUpdater.allowDowngrade = false;
  }

  async checkAtStartup(): Promise<void> {
    // Every packaged channel checks its own feed. The preference controls
    // automatic download/install, not whether the application can discover
    // and present a release at all.
    await this.checkForUpdatesInternal(
      'automatic',
      this.preferences?.automaticUpdates === true,
    );
  }

  checkForUpdates(): Promise<ApplicationUpdateCheckResult> {
    return this.checkForUpdatesInternal('manual', false);
  }

  getState(): ApplicationUpdatePanelState | undefined {
    return this.currentState;
  }

  isInstalling(): boolean {
    return this.installingUpdate;
  }

  async downloadUpdate(): Promise<ApplicationUpdatePanelState> {
    if (this.downloadRequest) return this.downloadRequest;
    const state = this.currentState;
    if (!state || state.phase !== 'available') {
      throw new Error('No checked update is ready to download.');
    }

    const request = this.performDownload(state);
    this.downloadRequest = request;
    try {
      return await request;
    } finally {
      if (this.downloadRequest === request) this.downloadRequest = undefined;
    }
  }

  installUpdate(): void {
    if (this.currentState?.phase !== 'downloaded' || this.installingUpdate) {
      return;
    }
    this.installingUpdate = true;
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  }

  private async checkForUpdatesInternal(
    origin: ApplicationUpdatePanelState['origin'],
    downloadAutomatically: boolean,
  ): Promise<ApplicationUpdateCheckResult> {
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

    if (!app.isPackaged) {
      const unsupported: ApplicationUpdatePanelState = {
        phase: 'unsupported',
        origin,
        channel: BUILD_CHANNEL,
        currentVersion,
      };
      this.finishCheckState(unsupported);
      return {
        status: 'unsupported',
        channel: BUILD_CHANNEL,
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
        status: signal.available ? 'update-available' : 'up-to-date',
        channel: BUILD_CHANNEL,
        currentVersion,
        latestVersion: signal.version,
      };
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      updateLog.error('Update check failed.', error);
      const failedState: ApplicationUpdatePanelState = {
        phase: 'error',
        origin,
        channel: BUILD_CHANNEL,
        currentVersion,
        error,
      };
      this.finishCheckState(failedState);
      return {
        status: 'error',
        channel: BUILD_CHANNEL,
        currentVersion,
        error,
      };
    }
  }

  private waitForUpdateSignal(): Promise<UpdateSignal> {
    return new Promise<UpdateSignal>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const onAvailable = (info: {
        version: string;
        releaseNotes?: unknown;
      }) => finish(() => resolve({
        available: true,
        version: info.version,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      }));
      const onNotAvailable = (info: { version: string }) =>
        finish(() => resolve({ available: false, version: info.version }));
      const onError = (error: Error) => finish(() => reject(error));
      const timer = setTimeout(
        () => finish(() => reject(new Error('Update check timed out.'))),
        CHECK_TIMEOUT_MS,
      );
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

    const onProgress = (progress: ApplicationUpdateProgress) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.setProgressBar(progress.percent / 100);
      }
      this.updateState({
        ...available,
        phase: 'downloading',
        progress: normalizeProgress(progress),
      });
    };
    autoUpdater.on('download-progress', onProgress);

    try {
      await autoUpdater.downloadUpdate();
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
      if (available.origin === 'automatic') {
        // Automatic updates are opt-in. Once the opted-in download completes,
        // briefly publish the completed state and restart into the new build.
        setTimeout(() => this.installUpdate(), 750);
      }
      return downloaded;
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      updateLog.error('Update download failed.', error);
      const failed: ApplicationUpdatePanelState = {
        ...available,
        phase: 'error',
        error,
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

  private presentState(state: ApplicationUpdatePanelState): void {
    this.currentState = state;
    this.windows.showUpdateOverlay(state);
  }

  private updateState(state: ApplicationUpdatePanelState): void {
    this.currentState = state;
    this.windows.updateUpdateOverlay(state);
  }

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

function normalizeReleaseNotes(value: unknown): string | undefined {
  if (typeof value === 'string') return stripReleaseNoteMarkup(value);
  if (!Array.isArray(value)) return undefined;
  const notes = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as { version?: unknown; note?: unknown };
    if (typeof candidate.note !== 'string') return [];
    const prefix = typeof candidate.version === 'string'
      ? `${candidate.version}\n`
      : '';
    return [`${prefix}${stripReleaseNoteMarkup(candidate.note)}`];
  });
  return notes.length > 0 ? notes.join('\n\n') : undefined;
}

function stripReleaseNoteMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeProgress(
  progress: ApplicationUpdateProgress,
): ApplicationUpdateProgress {
  return {
    percent: Math.max(0, Math.min(100, progress.percent)),
    bytesPerSecond: Math.max(0, progress.bytesPerSecond),
    transferred: Math.max(0, progress.transferred),
    total: Math.max(0, progress.total),
  };
}
