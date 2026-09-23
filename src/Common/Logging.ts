/** Creates one immutable application log source definition. */
function defineLogSource(id: string, scope: string, label: string) {
  return {
    /** The stable preference and metadata ID. */
    id,
    /** The electron-log scope prefix. */
    scope,
    /** The user-facing source label. */
    label,
  } as const;
}

/** Every application-owned source that can be selected in logging preferences. */
export const APPLICATION_LOG_SOURCES = {
  /** The application lifecycle source. */
  application: defineLogSource('application', 'application', 'Application'),
  /** The Electron runtime source. */
  electron: defineLogSource('electron', 'electron', 'Electron'),
  /** The Bundle development manager source. */
  bundleDevelopment: defineLogSource(
    'bundle-development',
    'bundle-development',
    'BundleDevelopmentManager',
  ),
  /** The external downloader integration source. */
  externalDownloader: defineLogSource(
    'external-downloader',
    'external-downloader',
    'ExternalDownloaderManager',
  ),
  /** The update manager source. */
  updates: defineLogSource('updates', 'updates', 'UpdateManager'),
  /** The window manager source. */
  windowManager: defineLogSource(
    'window-manager',
    'window-manager',
    'WindowManager',
  ),
  /** The IPC manager source. */
  ipcManager: defineLogSource('ipc-manager', 'ipc-manager', 'IpcManager'),
  /** The picture-in-picture manager source. */
  pictureInPicture: defineLogSource(
    'picture-in-picture',
    'picture-in-picture',
    'PictureInPictureManager',
  ),
  /** The viewer renderer source. */
  rendererViewer: defineLogSource(
    'renderer-viewer',
    'renderer:viewer',
    'Viewer Renderer',
  ),
  /** The overlay renderer source. */
  rendererOverlay: defineLogSource(
    'renderer-overlay',
    'renderer:overlay',
    'Overlay Renderer',
  ),
  /** The Video renderer source. */
  rendererVideo: defineLogSource(
    'renderer-video',
    'renderer:video',
    'Video Renderer',
  ),
  /** The picture-in-picture renderer source. */
  rendererPictureInPicture: defineLogSource(
    'renderer-picture-in-picture',
    'renderer:picture-in-picture',
    'PiP Renderer',
  ),
  /** The Provider site renderer source. */
  rendererSite: defineLogSource(
    'renderer-site',
    'renderer:site',
    'Site Renderer',
  ),
} as const;

/** Defines a registered application log source key. */
export type ApplicationLogSourceKey = keyof typeof APPLICATION_LOG_SOURCES;

/** Defines a stable application log source ID. */
export type ApplicationLogSourceId =
  (typeof APPLICATION_LOG_SOURCES)[ApplicationLogSourceKey]['id'];

/** Every stable application log source ID. */
export const APPLICATION_LOG_SOURCE_IDS = Object.values(APPLICATION_LOG_SOURCES)
  .map((source) => source.id) as readonly ApplicationLogSourceId[];
