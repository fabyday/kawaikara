import { spawn } from 'node:child_process';
import { dialog, shell } from 'electron';
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
          '이 운영체제에서는 자동 설치를 지원하지 않습니다. 릴리스 페이지에서 설치해 주세요.',
        ),
      };
    }

    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: `${EXTERNAL_DOWNLOADER_APP_NAME} 설치`,
      message: `${EXTERNAL_DOWNLOADER_APP_NAME}를 다운로드하고 설치할까요?`,
      detail: current.platform === 'darwin'
        ? '릴리스 파일의 SHA-256을 확인한 뒤, 다운로드한 파일과 설치할 앱에서 macOS 격리 속성을 제거합니다. 관리자 권한은 사용하지 않으며 ~/Applications에만 설치합니다.'
        : '릴리스 파일의 SHA-256을 확인한 뒤 Windows 설치 프로그램을 실행합니다.',
      buttons: ['설치', '취소'],
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
        `YT Downloader ${installed.version ?? manifest.version} 설치가 완료되었습니다.`,
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
        'Windows 설치 프로그램을 열었습니다. 설치가 끝나면 다시 실행해 주세요.',
      ),
    };
  }
}
