import { randomUUID } from 'node:crypto';

/** Defines the shared PiP video discovery retry ms constant. */
export const PIP_VIDEO_DISCOVERY_RETRY_MS = 100;
/** Defines the shared PiP video discovery attempts constant. */
export const PIP_VIDEO_DISCOVERY_ATTEMPTS = 2;
/** Defines the shared PiP return button bounds constant. */
export const PIP_RETURN_BUTTON_BOUNDS = {
    /** The x value. */
    x: 12,
    /** The y value. */
    y: 12,
    /** The width value. */
    width: 40,
    /** The height value. */
    height: 40,
};
/** Defines the shared PiP restore message constant. */
export const PIP_RESTORE_MESSAGE = `__kawaikara_pip_restore_${randomUUID()}`;
/** Defines the shared PiP playback message constant. */
export const PIP_PLAYBACK_MESSAGE = `__kawaikara_pip_playback_${randomUUID()}`;
/** Defines the shared PiP control action debounce ms constant. */
export const PIP_CONTROL_ACTION_DEBOUNCE_MS = 300;
/** Defines the shared PiP playback button size constant. */
export const PIP_PLAYBACK_BUTTON_SIZE = 54;
/** Defines the unified PiP video-size console message prefix. */
export const PIP_VIDEO_SIZE_MESSAGE = `__kawaikara_pip_video_size_${randomUUID()}`;
/** Defines the minimum relative aspect-ratio change worth resizing for. */
export const PIP_ASPECT_RATIO_CHANGE_THRESHOLD = 0.015;
/** Defines the smooth PiP resize duration. */
export const PIP_RESIZE_ANIMATION_DURATION_MS = 260;
/** Defines the smooth PiP resize frame interval. */
export const PIP_RESIZE_ANIMATION_FRAME_MS = 16;
