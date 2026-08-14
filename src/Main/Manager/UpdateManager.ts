import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import {
  BUILD_CHANNEL,
  toUpdaterChannel,
  type ReleaseChannel,
} from '../../Common/BuildConfig';
import type {
  ApplicationUpdateCheckResult,
  AppLocale,
  PreferenceState,
} from '../../Common/IPC';

const CHECK_TIMEOUT_MS = 60_000;

interface UpdateSignal {
  readonly available: boolean;
  readonly version: string;
}

export class UpdateManager {
  private preferences?: PreferenceState;
  private checkRequest?: Promise<ApplicationUpdateCheckResult>;
  private installingUpdate = false;

  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
  }

  configure(preferences: PreferenceState): void {
    this.preferences = preferences;
    const channel = this.resolveChannel(preferences.updateChannel);
    this.applyChannel(channel);
  }

  private applyChannel(channel: ReleaseChannel): void {
    autoUpdater.channel = toUpdaterChannel(channel);
    autoUpdater.allowPrerelease = channel !== 'stable';
    autoUpdater.allowDowngrade = true;
  }

  async checkAtStartup(): Promise<void> {
    if (!this.preferences?.automaticUpdates) return;
    await this.checkForUpdates(true);
  }

  async checkForUpdates(
    offerInstallation = true,
    preferredChannel?: ReleaseChannel,
  ): Promise<ApplicationUpdateCheckResult> {
    if (this.checkRequest) return this.checkRequest;
    const request = this.performCheck(offerInstallation, preferredChannel);
    this.checkRequest = request;
    try {
      return await request;
    } finally {
      if (this.checkRequest === request) this.checkRequest = undefined;
      this.applyChannel(this.resolveChannel(this.preferences?.updateChannel));
    }
  }

  isInstalling(): boolean {
    return this.installingUpdate;
  }

  private async performCheck(
    offerInstallation: boolean,
    preferredChannel?: ReleaseChannel,
  ): Promise<ApplicationUpdateCheckResult> {
    const channel = this.resolveChannel(
      preferredChannel ?? this.preferences?.updateChannel,
    );
    const currentVersion = app.getVersion();

    if (!app.isPackaged) {
      return {
        status: 'unsupported',
        channel,
        currentVersion,
      };
    }

    this.applyChannel(channel);

    try {
      const signal = await this.waitForUpdateSignal();
      const result: ApplicationUpdateCheckResult = {
        status: signal.available ? 'update-available' : 'up-to-date',
        channel,
        currentVersion,
        latestVersion: signal.version,
      };

      if (signal.available && offerInstallation) {
        const error = await this.offerUpdate(signal.version, channel);
        if (error) return { ...result, status: 'error', error };
      }
      return result;
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      log.error('Update check failed.', error);
      return {
        status: 'error',
        channel,
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
      const onAvailable = (info: { version: string }) =>
        finish(() => resolve({ available: true, version: info.version }));
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

  private async offerUpdate(
    version: string,
    channel: ReleaseChannel,
  ): Promise<string | undefined> {
    const messages = getUpdateMessages(this.preferences?.appLocale ?? 'system');
    const prompt = await dialog.showMessageBox({
      type: 'info',
      title: messages.foundTitle,
      message: messages.foundMessage.replace('{version}', version),
      detail: `${messages.channel}: ${channel}`,
      buttons: [messages.download, messages.later],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (prompt.response !== 0) return undefined;

    const onProgress = (progress: { percent: number }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.setProgressBar(progress.percent / 100);
      }
    };
    autoUpdater.on('download-progress', onProgress);
    try {
      await autoUpdater.downloadUpdate();
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      await dialog.showMessageBox({
        type: 'error',
        title: messages.errorTitle,
        message: messages.downloadFailed,
        detail: error,
      });
      return error;
    } finally {
      autoUpdater.off('download-progress', onProgress);
      for (const window of BrowserWindow.getAllWindows()) {
        window.setProgressBar(-1);
      }
    }

    const install = await dialog.showMessageBox({
      type: 'info',
      title: messages.readyTitle,
      message: messages.readyMessage,
      buttons: [messages.restart, messages.later],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (install.response === 0) {
      this.installingUpdate = true;
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    }
    return undefined;
  }

  private resolveChannel(preferred?: ReleaseChannel): ReleaseChannel {
    if (BUILD_CHANNEL === 'nightly') return 'nightly';
    return preferred ?? BUILD_CHANNEL;
  }
}

function getUpdateMessages(locale: AppLocale) {
  const resolved = locale === 'system' ? app.getLocale() : locale;
  if (resolved.toLowerCase().startsWith('ko')) {
    return {
      foundTitle: 'Kawaikara 업데이트',
      foundMessage: 'Kawaikara {version} 업데이트를 설치할 수 있습니다.',
      channel: '채널',
      download: '다운로드 및 설치',
      later: '나중에',
      errorTitle: '업데이트 오류',
      downloadFailed: '업데이트를 다운로드하지 못했습니다.',
      readyTitle: '업데이트 준비 완료',
      readyMessage: '앱을 다시 시작하여 업데이트를 설치할까요?',
      restart: '다시 시작',
    };
  }
  if (resolved.toLowerCase().startsWith('ja')) {
    return {
      foundTitle: 'Kawaikaraアップデート',
      foundMessage: 'Kawaikara {version}をインストールできます。',
      channel: 'チャンネル',
      download: 'ダウンロードしてインストール',
      later: '後で',
      errorTitle: 'アップデートエラー',
      downloadFailed: 'アップデートをダウンロードできませんでした。',
      readyTitle: 'アップデートの準備完了',
      readyMessage: 'アプリを再起動してアップデートをインストールしますか？',
      restart: '再起動',
    };
  }
  return {
    foundTitle: 'Kawaikara update',
    foundMessage: 'Kawaikara {version} is ready to install.',
    channel: 'Channel',
    download: 'Download and install',
    later: 'Later',
    errorTitle: 'Update error',
    downloadFailed: 'The update could not be downloaded.',
    readyTitle: 'Update ready',
    readyMessage: 'Restart the app to install the update?',
    restart: 'Restart',
  };
}
