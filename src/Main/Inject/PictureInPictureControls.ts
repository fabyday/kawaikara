import {
  serializePageInjection,
  serializePageInjectionWithOptions,
} from './Serialize';

/**
 * Small page-world commands for an already active unified PiP session.
 *
 * Every exported factory is called by UnifiedPictureInPictureManager.ts:
 * activateControl() toggles playback, setControlsVisible() updates hover UI,
 * refreshActiveVideo() pauses an obsolete frame, restoreInjectedVideo() exits
 * the video document, and restoreHostFrames() exits iframe host documents.
 * Entry/refresh/host creation lives in UnifiedPictureInPicturePage.ts.
 */

interface UnifiedPictureInPicturePageState {
  /** The backdrop value. */
  readonly backdrop: HTMLElement;
  /** Whether the controls option is enabled. */
  readonly controls: boolean;
  /** The controls style value. */
  readonly controlsStyle: HTMLStyleElement;
  /** The elements value. */
  readonly elements: readonly {
    /** The element value. */
    readonly element: HTMLElement;
    /** The marker value. */
    readonly marker: string | null;
    /** The style value. */
    readonly style: string | null;
  }[];
  /** The overlay value. */
  readonly overlay: HTMLElement;
  /** Callback used to handle render playback button. */
  readonly renderPlaybackButton: () => void;
  /** The shadow observer value. */
  readonly shadowObserver?: MutationObserver;
  /** The shadow styles value. */
  readonly shadowStyles?: readonly HTMLStyleElement[];
  /** The video marker value. */
  readonly videoMarker: string | null;
  /** The video value. */
  video: HTMLVideoElement;
}

/** Describes the unified picture in picture page global contract. */
interface UnifiedPictureInPicturePageGlobal extends Window {
  /** The Kawaikara unified picture in picture value. */
  __kawaikaraUnifiedPictureInPicture?: UnifiedPictureInPicturePageState;
}

/** Toggles the picture in picture playback. */
async function togglePictureInPicturePlayback(): Promise<{
  /** The message value. */
  readonly message?: string;
  /** Whether the paused option is enabled. */
  readonly paused?: boolean;
  /** The status value. */
  readonly status: 'missing' | 'toggled' | 'failed';
}> {
  const state = (window as UnifiedPictureInPicturePageGlobal)
    .__kawaikaraUnifiedPictureInPicture;
  if (!state?.video) return {
    /** The status value. */
    status: 'missing',
  };
  try {
    if (state.video.paused || state.video.ended) {
      if (state.video.ended) state.video.currentTime = 0;
      await state.video.play();
    } else {
      state.video.pause();
    }
    state.renderPlaybackButton();
    return {
      /** The status value. */
      status: 'toggled',
      /** The paused value. */
      paused: state.video.paused,
    };
  } catch (error) {
    return {
      /** The status value. */
      status: 'failed',
      /** The message value. */
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Performs the exit unified picture in picture operation. */
async function exitUnifiedPictureInPicture(): Promise<{
  /** The status value. */
  status: 'exited';
}> {
  const pageWindow = window as UnifiedPictureInPicturePageGlobal;
  const state = pageWindow.__kawaikaraUnifiedPictureInPicture;
  if (!state) return {
    /** The status value. */
    status: 'exited',
  };
  document.dispatchEvent(new Event('kawaikara:picture-in-picture-transition'));
  state.video.controls = state.controls;
  state.video.removeEventListener('play', state.renderPlaybackButton);
  state.video.removeEventListener('pause', state.renderPlaybackButton);
  state.video.removeEventListener('ended', state.renderPlaybackButton);
  for (const { element, marker, style } of state.elements) {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
    if (marker === null) {
      element.removeAttribute('data-kawaikara-unified-pip-video-path');
    } else {
      element.setAttribute('data-kawaikara-unified-pip-video-path', marker);
    }
  }
  state.controlsStyle.remove();
  state.shadowObserver?.disconnect();
  state.shadowStyles?.forEach((style) => style.remove());
  state.overlay.remove();
  state.backdrop.remove();
  if (state.videoMarker === null) {
    state.video.removeAttribute('data-kawaikara-unified-pip-video');
  } else {
    state.video.setAttribute(
      'data-kawaikara-unified-pip-video',
      state.videoMarker,
    );
  }
  delete pageWindow.__kawaikaraUnifiedPictureInPicture;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  return {
    /** The status value. */
    status: 'exited',
  };
}

/** Sets the picture in picture controls visible. */
function setPictureInPictureControlsVisible(visible: boolean): void {
  const state = (window as UnifiedPictureInPicturePageGlobal)
    .__kawaikaraUnifiedPictureInPicture;
  state?.overlay.toggleAttribute('data-controls-visible', visible);
}

/** Performs the pause document videos operation. */
function pauseDocumentVideos(): void {
  document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    video.pause();
  });
}

/** Performs the exit unified picture in picture host operation. */
function exitUnifiedPictureInPictureHost(): {
  /** The status value. */
  status: 'exited';
} {
  /** Describes the host state contract. */
  interface HostState {
    /** The elements value. */
    readonly elements: readonly {
      /** The element value. */
      readonly element: HTMLElement;
      /** The marker value. */
      readonly marker: string | null;
      /** The style value. */
      readonly style: string | null;
    }[];
    /** The style value. */
    readonly style: HTMLStyleElement;
  }
  const pageWindow = window as Window & {
    __kawaikaraUnifiedPictureInPictureHost?: HostState;
  };
  const state = pageWindow.__kawaikaraUnifiedPictureInPictureHost;
  if (!state) return {
    /** The status value. */
    status: 'exited',
  };
  for (const { element, marker, style } of state.elements) {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
    if (marker === null) {
      element.removeAttribute('data-kawaikara-unified-pip-host-path');
    } else {
      element.setAttribute('data-kawaikara-unified-pip-host-path', marker);
    }
  }
  state.style.remove();
  delete pageWindow.__kawaikaraUnifiedPictureInPictureHost;
  return {
    /** The status value. */
    status: 'exited',
  };
}

/** Creates the toggle picture in picture playback script. */
export const createTogglePictureInPicturePlaybackScript = (): string =>
  serializePageInjection(togglePictureInPicturePlayback);
/** Creates the exit unified picture in picture script. */
export const createExitUnifiedPictureInPictureScript = (): string =>
  serializePageInjection(exitUnifiedPictureInPicture);
/** Creates the set picture in picture controls visible script. */
export const createSetPictureInPictureControlsVisibleScript = (
  visible: boolean,
): string => serializePageInjectionWithOptions(
  setPictureInPictureControlsVisible,
  visible,
);
/** Creates the pause document videos script. */
export const createPauseDocumentVideosScript = (): string =>
  serializePageInjection(pauseDocumentVideos);
/** Creates the exit unified picture in picture host script. */
export const createExitUnifiedPictureInPictureHostScript = (): string =>
  serializePageInjection(exitUnifiedPictureInPictureHost);
