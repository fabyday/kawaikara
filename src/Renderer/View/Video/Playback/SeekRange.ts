import Hls from 'hls.js';
import { PlaybackBackend, PlayerSource, VideoSeekRange } from '../Types';

/** Performs the clamp video time operation. */
export function clampVideoTime(value: number, duration: number): number {
  const maximum = Number.isFinite(duration) && duration > 0
    ? duration
    : Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(0, value));
}

/** Performs the clamp seekable video time operation. */
export function clampSeekableVideoTime(
  value: number,
  range: VideoSeekRange,
): number {
  const length = range.end - range.start;
  const maximum = Math.max(
    range.start,
    range.end - Math.min(0.05, length / 2),
  );
  return Math.min(maximum, Math.max(range.start, value));
}

/** Performs the finite seek range operation. */
export function finiteSeekRange(duration: number): VideoSeekRange | undefined {
  return Number.isFinite(duration) && duration > 0
    ? {
      /** The start value. */
      start: 0,
      /** The end value. */
      end: duration,
    }
    : undefined;
}

/** Reads the video seek range. */
export function readVideoSeekRange(
  video: HTMLVideoElement,
  hls?: Hls | null,
): VideoSeekRange | undefined {
  if (video.seekable.length === 0) return undefined;
  const start = video.seekable.start(0);
  const seekableEnd = video.seekable.end(video.seekable.length - 1);
  const liveSyncPosition = hls?.liveSyncPosition;
  const end = typeof liveSyncPosition === 'number' &&
    Number.isFinite(liveSyncPosition) &&
    liveSyncPosition > start
    ? Math.min(seekableEnd, liveSyncPosition)
    : seekableEnd;
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? {
      /** The start value. */
      start,
      /** The end value. */
      end,
    }
    : undefined;
}

/** Resolves the video seek range. */
export function resolveVideoSeekRange(
  duration: number,
  source: PlayerSource | undefined,
  backend: PlaybackBackend,
  video: HTMLVideoElement | null,
  hls: Hls | null,
): VideoSeekRange | undefined {
  if (source?.kind === 'hls' && backend === 'chromium' && video) {
    return readVideoSeekRange(video, hls);
  }
  return finiteSeekRange(duration);
}

/** Performs the same seek range operation. */
export function sameSeekRange(
  left: VideoSeekRange | undefined,
  right: VideoSeekRange | undefined,
): boolean {
  if (!left || !right) return left === right;
  return Math.abs(left.start - right.start) < 0.01 &&
    Math.abs(left.end - right.end) < 0.01;
}
