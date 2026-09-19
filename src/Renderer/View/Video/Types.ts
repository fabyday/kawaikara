import Hls from 'hls.js';
import type {
  PreferenceState
} from '../../../Common/IPC';

/** Describes the player source contract. */
export interface PlayerSource {
  /** The native value value. */
  readonly nativeValue: string;
  /** The chromium value value. */
  readonly chromiumValue: string;
  /** The label value. */
  readonly label: string;
  /** The kind value. */
  readonly kind: 'local' | 'hls';
}

/** Describes the chromium source handle contract. */
export interface ChromiumSourceHandle {
  /** Cancels pending source validation. */
  readonly cancel: () => void;
  /** The hls value. */
  readonly hls: Hls | null;
  /** Whether the ready option is enabled. */
  readonly ready: Promise<void>;
}

/** Describes the pending MPV seek contract. */
export interface PendingMpvSeek {
  /** Whether the report error option is enabled. */
  readonly reportError: boolean;
  /** The seconds value. */
  readonly seconds: number;
}

/** Describes a raw event emitted by the libmpv renderer element. */
export interface MpvRawEvent {
  /** The event type. */
  readonly type: string;
  /** The optional property name. */
  readonly name?: string;
  /** The optional event value. */
  readonly data?: unknown;
  /** The optional event error. */
  readonly error?: string;
}

/** Describes an in-progress playback source validation. */
export interface PlaybackSourceValidation {
  /** Cancels the validation listeners and timer. */
  readonly cancel: () => void;
  /** Resolves once the newly opened source has decodable video. */
  readonly ready: Promise<void>;
}

/** Describes the video seek range contract. */
export interface VideoSeekRange {
  /** The start value. */
  readonly start: number;
  /** The end value. */
  readonly end: number;
}

/** Defines the playback backend type. */
export type PlaybackBackend = 'detecting' | 'libmpv' | 'chromium';

/** Defines the fallback reason type. */
export type FallbackReason = 'intel-mac' | 'unavailable' | 'native-error';

/** Defines the video preferences type. */
export type VideoPreferences = Pick<
  PreferenceState,
  | 'appTheme'
  | 'shortcuts'
  | 'videoControlsLayout'
  | 'videoOverlayHideSeconds'
  | 'videoSeekSeconds'
  | 'videoVolume'
>;
