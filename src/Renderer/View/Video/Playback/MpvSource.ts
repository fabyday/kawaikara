import type { VideoMessages } from '../../../../Common/IPC';
import {
  type MpvVideoElement
} from 'electron-mpv-video/renderer';
import { getErrorText } from '../Presentation';
import { MpvRawEvent, PlaybackSourceValidation } from '../Types';
import { MPV_SOURCE_VALIDATION_TIMEOUT_MS } from './PlayerDefaults';

/** Monitors whether the next libmpv source becomes a decodable video. */
export function monitorMpvSourceValidation(
  player: MpvVideoElement,
  labels: VideoMessages,
): PlaybackSourceValidation {
  let started = false;
  let fileLoaded = false;
  let videoWidth = 0;
  let videoHeight = 0;
  let settled = false;
  let timer = 0;
  /** Resolves the externally returned validation promise. */
  let resolveReady: () => void = () => undefined;
  /** Rejects the externally returned validation promise. */
  let rejectReady: (reason: Error) => void = () => undefined;

  /** Removes the temporary source-validation observers. */
  const cleanup = () => {
    window.clearTimeout(timer);
    player.removeEventListener('mpv-event', handleRawEvent);
  };
  /** Resolves source validation. */
  const resolve = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolveReady();
  };
  /** Rejects source validation. */
  const reject = (reason: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectReady(reason);
  };
  /** Handles a raw libmpv lifecycle event. */
  function handleRawEvent(event: Event): void {
    const detail = (event as CustomEvent<MpvRawEvent>).detail;
    if (detail.type === 'start-file') {
      started = true;
      fileLoaded = false;
      videoWidth = 0;
      videoHeight = 0;
      return;
    }
    if (!started) return;
    if (detail.error) {
      reject(new Error(`libmpv ${detail.type}: ${detail.error}`));
      return;
    }
    if (detail.type === 'file-loaded') {
      fileLoaded = true;
      if (videoWidth > 0 && videoHeight > 0) resolve();
      return;
    }
    if (detail.type === 'property-change') {
      if (detail.name === 'width' && typeof detail.data === 'number') {
        videoWidth = detail.data;
      } else if (detail.name === 'height' && typeof detail.data === 'number') {
        videoHeight = detail.data;
      }
      if (fileLoaded && videoWidth > 0 && videoHeight > 0) resolve();
      return;
    }
    if (
      detail.type === 'end-file' &&
      (!fileLoaded || videoWidth <= 0 || videoHeight <= 0)
    ) {
      reject(new Error(labels.sourceEnded));
    }
  }
  const ready = new Promise<void>((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise;
    rejectReady = rejectPromise;
  });
  player.addEventListener('mpv-event', handleRawEvent);
  timer = window.setTimeout(() => {
    reject(new Error(labels.sourceTimeout));
  }, MPV_SOURCE_VALIDATION_TIMEOUT_MS);

  return {
    /** Cancels the operation. */
    cancel: () => {
      reject(new Error(labels.sourceCanceled));
    },
    /** Whether the ready option is enabled. */
    ready,
  };
}

/** Determines whether the MPV runtime error condition applies. */
export function isMpvRuntimeError(reason: unknown): boolean {
  const message = getErrorText(reason);
  return /mpv_addon|libmpv|native module|unsupported platform|sharedTexture API|module could not be found|was compiled against|specified module could not be found/i.test(
    message,
  );
}

/** Prevents the package from probing the frozen shared-texture path on retry. */
export function disableWebGpuForMpvSoftwareRenderer(): void {
  Object.defineProperty(Navigator.prototype, 'gpu', {
    configurable: true,
    value: undefined,
  });
}
