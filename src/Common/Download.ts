/** Operating systems supported by the external downloader integration. */
export type ExternalDownloaderPlatform = 'darwin' | 'win32' | 'linux';

/**
 * Snapshot returned by the downloader status API and embedded in open/install
 * results so renderer callers can update their UI without requesting status
 * again.
 */
export interface ExternalDownloaderStatus {
  /** Whether a launchable downloader installation was found. */
  readonly installed: boolean;
  /** Whether Kawaikara can install the downloader on the current platform. */
  readonly automaticInstallSupported: boolean;
  /** Platform used to resolve artifacts, executable paths, and launch behavior. */
  readonly platform: ExternalDownloaderPlatform;
  /** Detected application version, when the installation exposes one. */
  readonly version?: string;
  /** Resolved application or executable path used for direct launching. */
  readonly appPath?: string;
  /** User-facing diagnostic or next-step message for an unavailable operation. */
  readonly message?: string;
}

/**
 * Result of `downloads.open()`. Consumers use `opened` to determine whether a
 * downloader process or deep link was launched and `status` to render the
 * installation state when launching was not possible.
 */
export interface ExternalDownloaderOpenResult {
  /** Whether Kawaikara successfully handed the source URL to the downloader. */
  readonly opened: boolean;
  /** Downloader status captured immediately before the launch attempt. */
  readonly status: ExternalDownloaderStatus;
}

/**
 * Result of `downloads.install()`. It distinguishes a user cancellation from
 * an installer launch and reports whether an already installed downloader was
 * opened for the optional source URL.
 */
export interface ExternalDownloaderInstallResult {
  /** Whether the user declined the installation confirmation. */
  readonly canceled: boolean;
  /** Whether the platform installer was downloaded and started. */
  readonly installerStarted: boolean;
  /** Whether an existing or newly installed downloader opened the source URL. */
  readonly opened: boolean;
  /** Latest known downloader status after the installation flow. */
  readonly status: ExternalDownloaderStatus;
}
