import type { Input } from 'electron';
import type { ShortFormVideoContribution } from '@kawaikara/site-api';
import { VIDEO_SHORTCUTS } from '../../Common/VideoControls';

/** Describes the shortcut binding contract. */
export interface ShortcutBinding {
  /** The ID value. */
  readonly id: string;
  /** The default key value. */
  readonly defaultKey: string;
  /** Runs the operation. */
  run(): void | Promise<void>;
}

/** Determines whether the repeatable short form navigation shortcut condition applies. */
export function isRepeatableShortFormNavigationShortcut(
  shortcutId: string,
): boolean {
  return shortcutId === 'short-form-video.previous' ||
    shortcutId === 'short-form-video.next';
}

/** Performs the supports short form shortcut operation. */
export function supportsShortFormShortcut(
  shortcutId: string,
  contribution: ShortFormVideoContribution,
): boolean {
  if (shortcutId === 'short-form-video.previous') return contribution.previous === true;
  if (shortcutId === 'short-form-video.next') return contribution.next === true;
  if (shortcutId === 'short-form-video.toggle-auto-advance') {
    return Boolean(contribution.autoAdvance);
  }
  if (shortcutId === 'short-form-video.ban-current-publisher') {
    return Boolean(contribution.publisherBan);
  }
  return false;
}

/** Performs the matches video shortcut input operation. */
export function matchesVideoShortcutInput(
  input: Input,
  overrides: Readonly<Record<string, string>>,
): boolean {
  return VIDEO_SHORTCUTS.some(({ id, defaultKey }) => {
    const accelerator = overrides[id] ?? defaultKey;
    if (!accelerator.trim()) return false;
    if (matchesAccelerator(input, accelerator)) return true;

    // Control and Alt can be layered on top of a configured Video shortcut
    // to request a smaller seek distance.
    const variants: Input[] = [];
    if (input.control) variants.push({ ...input, control: false
    });
    if (input.alt) variants.push({ ...input, alt: false
    });
    if (input.control && input.alt) {
      variants.push({ ...input, control: false, alt: false
      });
    }
    return variants.some((variant) => matchesAccelerator(variant, accelerator));
  });
}

/** Performs the matches accelerator operation. */
export function matchesAccelerator(input: Input, accelerator: string): boolean {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) return false;

  let needsControl = false;
  let needsMeta = false;
  let needsAlt = false;
  let needsShift = false;
  for (const modifier of parts) {
    switch (modifier) {
      case 'commandorcontrol':
      case 'cmdorctrl':
        if (process.platform === 'darwin') needsMeta = true;
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
        return false;
    }
  }

  return (
    input.control === needsControl &&
    input.meta === needsMeta &&
    input.alt === needsAlt &&
    input.shift === needsShift &&
    normalizeInputKey(input) === normalizeAcceleratorKey(key)
  );
}

/** Normalizes the input key. */
function normalizeInputKey(input: Input): string {
  if (/^Key[A-Z]$/i.test(input.code)) return input.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(input.code)) return input.code.slice(5);
  if (/^Numpad[0-9]$/.test(input.code)) return input.code.slice(6);
  if (input.code === 'Comma') return ',';
  if (input.code === 'Period') return '.';
  return normalizeAcceleratorKey(input.key);
}

/** Normalizes the accelerator key. */
function normalizeAcceleratorKey(key: string): string {
  const normalized = key.toLowerCase();
  const aliases: Record<string, string> = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down',
    return: 'enter',
    esc: 'escape',
    space: ' ',
    spacebar: ' ',
    comma: ',',
  };
  return aliases[normalized] ?? normalized;
}
