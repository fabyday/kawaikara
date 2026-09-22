/** Stable capability name shared by every compatible media downloader. */
export const MEDIA_DOWNLOAD_CAPABILITY_ID = 'media.download' as const;
/** Current version of the shared media download contract. */
export const MEDIA_DOWNLOAD_CAPABILITY_VERSION = 1 as const;

/** Optional behavior a downloader may advertise during capability negotiation. */
export type MediaDownloadFeature =
  | 'audio'
  | 'browser-session'
  | 'format-selection'
  | 'playlist'
  | 'quality-selection'
  | 'subtitles'
  | 'time-range'
  | 'video';

/** Page resource forwarded to a downloader for authoritative validation. */
export interface MediaDownloadResource {
  /** Distinguishes page-backed media from future local/file inputs. */
  readonly kind: 'web-media';
  /** Provider hint used by the companion; Kawaikara does not treat it as proof. */
  readonly service?: string;
  /** Canonical source URL supplied by the active Provider. */
  readonly url: string;
  /** Optional display metadata. */
  readonly title?: string;
}

/** A versioned request delivered to the selected downloader. */
export interface MediaDownloadRequest {
  /** The capability ID value. */
  readonly capability: typeof MEDIA_DOWNLOAD_CAPABILITY_ID;
  /** The capability version value. */
  readonly version: typeof MEDIA_DOWNLOAD_CAPABILITY_VERSION;
  /** Resource whose actual support is decided by the external application. */
  readonly resource: MediaDownloadResource;
  /** Desired behavior; the companion may reject unsupported requirements. */
  readonly requiredFeatures?: readonly MediaDownloadFeature[];
}

/** Stable failure reasons returned by a downloader without throwing into the Provider. */
export type MediaDownloadFailureCode =
  | 'app-error'
  | 'invalid-request'
  | 'permission-denied'
  | 'timeout'
  | 'unavailable'
  | 'unsupported-source'
  | 'unsupported-version';

/** Structured result owned by the external application's capability handler. */
export type MediaDownloadResult =
  | {
      /** Whether the accepted option is enabled. */
      readonly accepted: true;
      /** External job ID when the companion creates a background task. */
      readonly requestId?: string;
    }
  | {
      /** Whether the accepted option is enabled. */
      readonly accepted: false;
      /** Machine-readable failure used for recovery and UI selection. */
      readonly code: MediaDownloadFailureCode;
      /** Safe user-facing detail supplied by the companion. */
      readonly message?: string;
      /** Whether retrying after user action or application recovery may succeed. */
      readonly recoverable: boolean;
    };
