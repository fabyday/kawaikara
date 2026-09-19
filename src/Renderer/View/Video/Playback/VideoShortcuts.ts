import {
  type MpvVideoElement,
  type MpvVideoState
} from 'electron-mpv-video/renderer';
import {
  type VideoShortcutId
} from '../../../../Common/VideoControls';
import { PlaybackBackend } from '../Types';
import { DEFAULT_FRAME_RATE } from './PlayerDefaults';
import { clampVideoTime } from './SeekRange';

/** Runs the video shortcut. */
export async function runVideoShortcut(
  player: MpvVideoElement | null,
  fallbackVideo: HTMLVideoElement | null,
  backend: PlaybackBackend,
  state: MpvVideoState,
  shortcutId: VideoShortcutId,
  seekSeconds: number,
  seekTo: (seconds: number) => void,
): Promise<void> {
  if (backend === 'detecting') return;
  const direction =
    shortcutId === 'video.frame-backward' || shortcutId === 'video.seek-backward'
      ? -1
      : 1;
  const frameStep =
    shortcutId === 'video.frame-backward' || shortcutId === 'video.frame-forward';
  if (frameStep) {
    const fps = state.fps > 1 && state.fps < 240 ? state.fps : DEFAULT_FRAME_RATE;
    const distance = 1 / fps + 0.000_1;
    const target = clampVideoTime(state.time + direction * distance, state.duration);
    if (backend === 'chromium') {
      if (!fallbackVideo) return;
      fallbackVideo.pause();
    } else {
      if (!player) return;
      await player.pause();
    }
    seekTo(target);
    return;
  }
  const target = clampVideoTime(
    state.time + direction * seekSeconds,
    state.duration,
  );
  seekTo(target);
}

/** Performs the match video accelerator operation. */
export function matchVideoAccelerator(
  event: KeyboardEvent,
  accelerator: string,
  allowPrecisionModifiers: boolean,
): {
  /** Whether the matched option is enabled. */
  readonly matched: boolean;
  /** The precision value. */
  readonly precision: number;
} {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) return {
    /** The matched value. */
    matched: false,
    /** The precision value. */
    precision: 1,
  };

  const isMac = /mac/i.test(navigator.platform);
  let needsControl = false;
  let needsMeta = false;
  let needsAlt = false;
  let needsShift = false;
  for (const modifier of parts) {
    switch (modifier) {
      case 'commandorcontrol':
      case 'cmdorctrl':
        if (isMac) needsMeta = true;
        else needsControl = true;
        break;
      case 'command':
      case 'cmd':
      case 'super':
        needsMeta = true;
        break;
      case 'control':
      case 'ctrl':
        needsControl = true;
        break;
      case 'alt':
      case 'option':
        needsAlt = true;
        break;
      case 'shift':
        needsShift = true;
        break;
      default:
        return {
          /** The matched value. */
          matched: false,
          /** The precision value. */
          precision: 1,
        };
    }
  }

  const extraControl = allowPrecisionModifiers && event.ctrlKey && !needsControl;
  const extraAlt = allowPrecisionModifiers && event.altKey && !needsAlt;
  const modifiersMatch =
    event.metaKey === needsMeta &&
    event.shiftKey === needsShift &&
    (event.ctrlKey === needsControl || extraControl) &&
    (event.altKey === needsAlt || extraAlt);
  if (!modifiersMatch || normalizeKeyboardEventKey(event) !== normalizeKey(key)) {
    return {
      /** The matched value. */
      matched: false,
      /** The precision value. */
      precision: 1,
    };
  }
  return {
    /** The matched value. */
    matched: true,
    /** The precision value. */
    precision: (extraControl ? 0.5 : 1) * (extraAlt ? 0.25 : 1),
  };
}

/** Normalizes the keyboard event key. */
export function normalizeKeyboardEventKey(event: KeyboardEvent): string {
  if (event.code === 'Comma') return ',';
  if (event.code === 'Period') return '.';
  return normalizeKey(event.key);
}

/** Normalizes the key. */
export function normalizeKey(key: string): string {
  const normalized = key.toLowerCase();
  const aliases: Record<string, string> = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down',
    comma: ',',
    period: '.',
    space: ' ',
    spacebar: ' ',
    return: 'enter',
    esc: 'escape',
  };
  return aliases[normalized] ?? normalized;
}

/** Determines whether the editable target condition applies. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const editable = target.closest<HTMLElement>(
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]',
  );
  if (!editable) return false;
  return !(editable instanceof HTMLInputElement && editable.type === 'range');
}
