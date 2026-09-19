import type {
  AppTheme,
  VideoBrowserMessages,
  VideoLibraryFolder,
  VideoOpenRequest
} from '../../../../Common/IPC';

/** Describes the browser folder context menu contract. */
export interface BrowserFolderContextMenu {
  /** The folder value. */
  readonly folder: VideoLibraryFolder;
  /** The x value. */
  readonly x: number;
  /** The y value. */
  readonly y: number;
}

/** Describes the video browser props contract. */
export interface VideoBrowserProps {
  /** The initial directory value. */
  readonly initialDirectory?: string;
  /** The labels value. */
  readonly labels: VideoBrowserMessages;
  /** The theme value. */
  readonly theme: AppTheme;
  /** Whether the close option is enabled. */
  readonly canClose: boolean;
  /** The backend label value. */
  readonly backendLabel: string;
  /** The backend warning value. */
  readonly backendWarning?: string;
  /** Callback used to handle on close. */
  readonly onClose: () => void;
  /** Callback used to handle on open hls. */
  readonly onOpenHls: () => void;
  /** Callback used to handle on open video. */
  readonly onOpenVideo: (
    request: Extract<VideoOpenRequest, {
      /** The kind value. */
      readonly kind: 'local';
    }>,
    directory: string,
  ) => void;
  /** Callback used to handle on select file. */
  readonly onSelectFile: () => Promise<VideoOpenRequest | null>;
}
