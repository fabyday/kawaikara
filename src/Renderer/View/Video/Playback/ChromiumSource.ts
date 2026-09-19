import type { VideoMessages } from '../../../../Common/IPC';
import Hls from 'hls.js';
import { ChromiumSourceHandle, PlaybackSourceValidation, PlayerSource } from '../Types';
import { CHROMIUM_SOURCE_VALIDATION_TIMEOUT_MS } from './PlayerDefaults';

/** Opens the chromium source. */
export function openChromiumSource(
  video: HTMLVideoElement,
  source: PlayerSource,
  volume: number,
  onFatalError: (reason: unknown) => void,
  labels: VideoMessages,
): ChromiumSourceHandle {
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.volume = Math.min(1, Math.max(0, volume / 100));

  if (
    source.kind !== 'hls' ||
    video.canPlayType('application/vnd.apple.mpegurl') !== ''
  ) {
    const validation = waitForChromiumVideo(video, labels);
    video.src = source.chromiumValue;
    video.load();
    return {
      /** Cancels the operation. */
      cancel: validation.cancel,
      /** The hls value. */
      hls: null,
      /** Whether the ready option is enabled. */
      ready: validation.ready,
    };
  }

  if (!Hls.isSupported()) {
    return {
      /** Cancels the operation. */
      cancel: () => undefined,
      /** The hls value. */
      hls: null,
      /** Whether the ready option is enabled. */
      ready: Promise.reject(
        new Error(labels.hlsUnavailable),
      ),
    };
  }

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: true,
  });
  let opening = true;
  let manifestTimer = 0;
  /** Rejects manifest validation when the source changes. */
  let rejectManifest: (reason: Error) => void = () => undefined;
  const manifestReady = new Promise<void>((resolve, reject) => {
    rejectManifest = reject;
    manifestTimer = window.setTimeout(() => {
      if (!opening) return;
      opening = false;
      reject(new Error(labels.manifestTimeout));
    }, CHROMIUM_SOURCE_VALIDATION_TIMEOUT_MS);
    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      window.clearTimeout(manifestTimer);
      opening = false;
      resolve();
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      const reason = new Error(
        `HLS ${data.type}: ${data.details || labels.hlsFatal}`,
      );
      if (opening) {
        window.clearTimeout(manifestTimer);
        opening = false;
        reject(reason);
      } else {
        onFatalError(reason);
      }
    });
  });
  const videoValidation = waitForChromiumVideo(video, labels);
  hls.loadSource(source.chromiumValue);
  hls.attachMedia(video);
  return {
    /** Cancels the operation. */
    cancel: () => {
      window.clearTimeout(manifestTimer);
      if (opening) {
        opening = false;
        rejectManifest(new Error(labels.sourceCanceled));
      }
      videoValidation.cancel();
    },
    /** The hls value. */
    hls,
    /** Whether the ready option is enabled. */
    ready: Promise.all([manifestReady, videoValidation.ready]).then(() => undefined),
  };
}

/** Waits until Chromium has decoded video metadata for the selected source. */
export function waitForChromiumVideo(
  video: HTMLVideoElement,
  labels: VideoMessages,
): PlaybackSourceValidation {
  let settled = false;
  /** Resolves the externally returned validation promise. */
  let resolveReady: () => void = () => undefined;
  /** Rejects the externally returned validation promise. */
  let rejectReady: (reason: Error) => void = () => undefined;
  /** Removes temporary media validation listeners. */
  const cleanup = () => {
    window.clearTimeout(timer);
    video.removeEventListener('loadedmetadata', handleReady);
    video.removeEventListener('loadeddata', handleReady);
    video.removeEventListener('canplay', handleReady);
    video.removeEventListener('resize', handleReady);
    video.removeEventListener('error', handleError);
  };
  /** Resolves once the source exposes a real video track. */
  function handleReady(): void {
    if (settled || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    settled = true;
    cleanup();
    resolveReady();
  }
  /** Rejects media validation. */
  function reject(reason: Error): void {
    if (settled) return;
    settled = true;
    cleanup();
    rejectReady(reason);
  }
  /** Rejects when Chromium reports an invalid media source. */
  function handleError(): void {
    reject(new Error(video.error?.message || labels.sourceRejected));
  }
  const ready = new Promise<void>((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise;
    rejectReady = rejectPromise;
  });
  const timer = window.setTimeout(() => {
    reject(new Error(labels.sourceTimeout));
  }, CHROMIUM_SOURCE_VALIDATION_TIMEOUT_MS);
  video.addEventListener('loadedmetadata', handleReady);
  video.addEventListener('loadeddata', handleReady);
  video.addEventListener('canplay', handleReady);
  video.addEventListener('resize', handleReady);
  video.addEventListener('error', handleError);
  queueMicrotask(handleReady);

  return {
    /** Cancels the operation. */
    cancel: () => reject(new Error(labels.sourceCanceled)),
    /** Whether the ready option is enabled. */
    ready,
  };
}
