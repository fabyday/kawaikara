export type ExternalDownloaderPlatform = 'darwin' | 'win32' | 'linux';

export interface ExternalDownloaderStatus {
  readonly installed: boolean;
  readonly automaticInstallSupported: boolean;
  readonly platform: ExternalDownloaderPlatform;
  readonly version?: string;
  readonly appPath?: string;
  readonly message?: string;
}

export interface ExternalDownloaderOpenResult {
  readonly opened: boolean;
  readonly status: ExternalDownloaderStatus;
}

export interface ExternalDownloaderInstallResult {
  readonly canceled: boolean;
  readonly installerStarted: boolean;
  readonly opened: boolean;
  readonly status: ExternalDownloaderStatus;
}
