import {
  type MpvVideoState
} from 'electron-mpv-video/renderer';
import {
  type FocusEvent
} from 'react';
import type {
  VideoMessages
} from '../../../Common/IPC';
import { PlayerSource, VideoPreferences } from './Types';

/** Performs the blur video control operation. */
export function blurVideoControl(event: FocusEvent<HTMLElement>): void {
  event.currentTarget.blur();
}

/** Formats the duration. */
export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '--:--';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteText = String(minutes).padStart(hours ? 2 : 1, '0');
  const secondText = String(seconds).padStart(2, '0');
  return hours
    ? `${String(hours)}:${minuteText}:${secondText}`
    : `${minuteText}:${secondText}`;
}

/** Returns the metadata label. */
export function getMetadataLabel(
  state: MpvVideoState,
  hasTimeline: boolean,
  liveLabel: string,
): string {
  const parts = [];
  if (state.codec && state.codec !== '-') parts.push(state.codec.toUpperCase());
  if (state.width > 0 && state.height > 0) parts.push(`${state.width}×${state.height}`);
  if (state.fps > 0) parts.push(`${state.fps.toFixed(2).replace(/\.00$/, '')} fps`);
  parts.push(hasTimeline ? formatDuration(state.duration) : liveLabel);
  return parts.join(' · ');
}

/** Determines whether the HTTP URL condition applies. */
export function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Returns the stream label. */
export function getStreamLabel(value: string): string {
  try {
    const url = new URL(value);
    const tail = url.pathname.split('/').filter(Boolean).pop();
    return tail ? `${url.hostname} · ${tail}` : url.hostname;
  } catch {
    return value;
  }
}

/** Returns the chromium error message. */
export function getChromiumErrorMessage(
  reason: unknown,
  labels: VideoMessages,
): string {
  const message = getErrorText(reason).trim();
  return message
    ? `${labels.chromiumPlaybackFailed} ${message}`
    : labels.chromiumPlaybackFailed;
}

/** Returns an HLS source validation error message. */
export function getHlsPlaybackErrorMessage(
  reason: unknown,
  labels: VideoMessages,
): string {
  const message = getErrorText(reason).trim();
  return message
    ? `${labels.hlsPlaybackFailed} ${message}`
    : labels.hlsPlaybackFailed;
}

/** Returns the MPV error message. */
export function getMpvErrorMessage(reason: unknown, labels: VideoMessages): string {
  const message = getErrorText(reason);
  if (/mpv_addon|libmpv|dll|module could not be found|was compiled against/i.test(message)) {
    return labels.runtimeMissing;
  }
  return message.trim() ? `${labels.playbackFailed} ${message}` : labels.playbackFailed;
}

/** Returns the error text. */
export function getErrorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason ?? '');
}

/** Determines whether the same player source condition applies. */
export function isSamePlayerSource(
  current: PlayerSource | undefined,
  next: PlayerSource,
): boolean {
  return Boolean(
    current &&
    current.kind === next.kind &&
    current.nativeValue === next.nativeValue &&
    current.chromiumValue === next.chromiumValue,
  );
}

/** Performs the are video preferences equal operation. */
export function areVideoPreferencesEqual(
  current: VideoPreferences,
  next: VideoPreferences,
): boolean {
  return (
    current.appTheme === next.appTheme &&
    current.videoControlsLayout === next.videoControlsLayout &&
    current.videoOverlayHideSeconds === next.videoOverlayHideSeconds &&
    current.videoSeekSeconds === next.videoSeekSeconds &&
    current.videoVolume === next.videoVolume &&
    areShortcutRecordsEqual(current.shortcuts, next.shortcuts)
  );
}

/** Performs the are shortcut records equal operation. */
export function areShortcutRecordsEqual(
  current: VideoPreferences['shortcuts'],
  next: VideoPreferences['shortcuts'],
): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every((key) => current[key] === next[key])
  );
}
