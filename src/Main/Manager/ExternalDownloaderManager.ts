import { spawn } from 'node:child_process';
import { app, dialog, shell } from 'electron';
import type { AppLocale } from '../../Common/IPC';
import { getLocaleMessages } from '../Functional/Locale';
import type {
  ExternalDownloaderInstallResult,
  ExternalDownloaderOpenResult,
  ExternalDownloaderStatus,
} from '../../Common/Download';
import {
  createExternalDownloaderDeepLink,
  downloadExternalDownloaderWindowsInstaller,
  EXTERNAL_DOWNLOADER_APP_NAME,
  EXTERNAL_DOWNLOADER_RELEASES_PAGE,
  fetchExternalDownloaderReleaseManifest,
  findInstalledExternalDownloaderApp,
  getExternalDownloaderPlatform,
  installExternalDownloaderMacArtifact,
  requireYouTubeUrl,
  runExternalDownloaderCommand,
  selectExternalDownloaderArtifact,
} from '../Functional/ExternalDownloader';

/** Coordinates external downloader behavior. */
export class ExternalDownloaderManager {
  /** Reads the current application preference at the start of each operation. */
  constructor(
    /** Reads the current app locale without caching a stale preference. */
    private readonly getLocale: () => AppLocale = () => 'system',
  ) {}
  /** The install promise value. */
  private installPromise?: Promise<ExternalDownloaderInstallResult>;

  /** Returns the status. */
  async getStatus(message?: string): Promise<ExternalDownloaderStatus> {
    const platform = getExternalDownloaderPlatform();
    const installed = await findInstalledExternalDownloaderApp(platform);
    return {
      /** The installed value. */
      installed: Boolean(installed),
      /** The automatic install supported value. */
      automaticInstallSupported: platform === 'darwin' || platform === 'win32',
      /** The platform value. */
      platform,
      /** The version value. */
      version: installed?.version,
      /** The app path value. */
      appPath: installed?.path,
      /** The message value. */
      message,
    };
  }

  /** Opens the operation. */
  async open(value: unknown): Promise<ExternalDownloaderOpenResult> {
    const sourceUrl = requireYouTubeUrl(value);
    const status = await this.getStatus();
    if (!status.installed) return {
      /** The opened value. */
      opened: false,
      /** The status value. */
      status,
    };

    const deepLink = createExternalDownloaderDeepLink(sourceUrl);
    if (status.platform === 'darwin' && status.appPath) {
      await runExternalDownloaderCommand('/usr/bin/open', [
        '-a',
        status.appPath,
        deepLink,
      ]);
    } else if (status.platform === 'win32' && status.appPath) {
      const child = spawn(status.appPath, [deepLink], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();
    } else {
      await shell.openExternal(deepLink);
    }
    return {
      /** The opened value. */
      opened: true,
      /** The status value. */
      status,
    };
  }

  /** Installs the operation. */
  install(value?: unknown): Promise<ExternalDownloaderInstallResult> {
    if (!this.installPromise) {
      this.installPromise = this.installOnce(value).finally(() => {
        this.installPromise = undefined;
      });
    }
    return this.installPromise;
  }

  /** Opens the release page. */
  async openReleasePage(): Promise<void> {
    await shell.openExternal(EXTERNAL_DOWNLOADER_RELEASES_PAGE);
  }

  /** Installs the once. */
  private async installOnce(
    value?: unknown,
  ): Promise<ExternalDownloaderInstallResult> {
    const labels = getLocaleMessages(this.getLocale(), app.getLocale()).downloader;
    const sourceUrl = value === undefined || value === ''
      ? undefined
      : requireYouTubeUrl(value);
    const current = await this.getStatus();
    if (current.installed) {
      const openResult = sourceUrl
        ? await this.open(sourceUrl)
        : { opened: false, status: current
        };
      return {
        /** Whether the canceled option is enabled. */
        canceled: false,
        /** The installer started value. */
        installerStarted: false,
        /** The opened value. */
        opened: openResult.opened,
        /** The status value. */
        status: openResult.status,
      };
    }

    if (!current.automaticInstallSupported) {
      return {
        /** Whether the canceled option is enabled. */
        canceled: false,
        /** The installer started value. */
        installerStarted: false,
        /** The opened value. */
        opened: false,
        /** The status value. */
        status: await this.getStatus(
          labels.unsupported,
        ),
      };
    }

    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: labels.installTitle.replace('{name}', EXTERNAL_DOWNLOADER_APP_NAME),
      message: labels.installMessage.replace('{name}', EXTERNAL_DOWNLOADER_APP_NAME),
      detail: current.platform === 'darwin'
        ? labels.macInstallDetail
        : labels.windowsInstallDetail,
      buttons: [labels.confirmInstall, labels.cancel],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (confirmation.response !== 0) {
      return {
        /** Whether the canceled option is enabled. */
        canceled: true,
        /** The installer started value. */
        installerStarted: false,
        /** The opened value. */
        opened: false,
        /** The status value. */
        status: current,
      };
    }

    const manifest = await fetchExternalDownloaderReleaseManifest();
    const artifact = selectExternalDownloaderArtifact(
      manifest,
      current.platform,
      process.arch,
    );
    if (current.platform === 'darwin') {
      const installed = await installExternalDownloaderMacArtifact(
        manifest,
        artifact,
      );
      const status = await this.getStatus(
        labels.completed.replace('{version}', installed.version ?? manifest.version),
      );
      const openResult = sourceUrl
        ? await this.open(sourceUrl)
        : { opened: false, status
        };
      return {
        /** Whether the canceled option is enabled. */
        canceled: false,
        /** The installer started value. */
        installerStarted: false,
        /** The opened value. */
        opened: openResult.opened,
        /** The status value. */
        status: { ...openResult.status,
          /** The message value. */
          message: status.message,
        },
      };
    }

    const installerPath = await downloadExternalDownloaderWindowsInstaller(
      manifest,
      artifact,
    );
    const launchError = await shell.openPath(installerPath);
    if (launchError) throw new Error(launchError);
    return {
      /** Whether the canceled option is enabled. */
      canceled: false,
      /** The installer started value. */
      installerStarted: true,
      /** The opened value. */
      opened: false,
      /** The status value. */
      status: await this.getStatus(
        labels.windowsStarted,
      ),
    };
  }
}
