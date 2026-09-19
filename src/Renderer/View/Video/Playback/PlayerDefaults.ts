import {
  type MpvVideoState
} from 'electron-mpv-video/renderer';

/** Defines the shared default frame rate constant. */
export const DEFAULT_FRAME_RATE = 30;

/** Defines the shared video volume step constant. */
export const VIDEO_VOLUME_STEP = 5;

/** Defines the shared video scrub preview interval ms constant. */
export const VIDEO_SCRUB_PREVIEW_INTERVAL_MS = 100;

/** Defines the shared video long scrub preview interval ms constant. */
export const VIDEO_LONG_SCRUB_PREVIEW_INTERVAL_MS = 180;

/** Defines the shared video long duration seconds constant. */
export const VIDEO_LONG_DURATION_SECONDS = 2 * 60 * 60;

/** Defines the shared player UI update interval ms constant. */
export const PLAYER_UI_UPDATE_INTERVAL_MS = 100;

/** Defines the shared MPV initialization timeout ms constant. */
export const MPV_INITIALIZATION_TIMEOUT_MS = 8_000;

/** Defines the MPV source validation timeout ms constant. */
export const MPV_SOURCE_VALIDATION_TIMEOUT_MS = 20_000;

/** Defines the Chromium source validation timeout ms constant. */
export const CHROMIUM_SOURCE_VALIDATION_TIMEOUT_MS = 20_000;

/** Defines the shared initial player state constant. */
export const INITIAL_PLAYER_STATE: MpvVideoState = {
  /** The player ID value. */
  playerId: '',
  /** The status value. */
  status: 'Idle',
  /** The render mode value. */
  renderMode: 'webgl',
  /** The renderer name value. */
  rendererName: '-',
  /** The time value. */
  time: 0,
  /** The duration value. */
  duration: 0,
  /** The width value. */
  width: 0,
  /** The height value. */
  height: 0,
  /** The codec value. */
  codec: '-',
  /** The fps value. */
  fps: 0,
};
