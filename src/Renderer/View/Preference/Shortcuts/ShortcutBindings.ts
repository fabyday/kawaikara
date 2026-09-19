import {
  type KeyboardEvent
} from 'react';
import { ShortcutItem } from '../Types';

/** Returns the effective shortcut. */
export function getEffectiveShortcut(
  item: ShortcutItem,
  shortcuts: Readonly<Record<string, string>>,
): string {
  return Object.prototype.hasOwnProperty.call(shortcuts, item.id)
    ? shortcuts[item.id] ?? ''
    : item.defaultKey;
}

/** Performs the write shortcut override operation. */
export function writeShortcutOverride(
  current: Readonly<Record<string, string>>,
  item: ShortcutItem,
  accelerator: string,
): Record<string, string> {
  const shortcuts = {
    ...current
  };
  if (accelerator === item.defaultKey) delete shortcuts[item.id];
  else shortcuts[item.id] = accelerator;
  return shortcuts;
}

/** Finds the shortcut conflicts. */
export function findShortcutConflicts(
  targetId: string,
  items: readonly ShortcutItem[],
  shortcuts: Readonly<Record<string, string>>,
): string[] {
  const target = items.find((item) => item.id === targetId);
  if (!target) return [];
  const value = normalizeAccelerator(getEffectiveShortcut(target, shortcuts));
  if (!value) return [];
  return items
    .filter(
      (item) =>
        item.id !== targetId &&
        normalizeAccelerator(getEffectiveShortcut(item, shortcuts)) === value,
    )
    .map((item) => item.id);
}

/** Finds the duplicate shortcut IDs. */
export function findDuplicateShortcutIds(
  items: readonly ShortcutItem[],
  shortcuts: Readonly<Record<string, string>>,
): Set<string> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const accelerator = normalizeAccelerator(
      getEffectiveShortcut(item, shortcuts),
    );
    if (!accelerator) continue;
    const ids = groups.get(accelerator) ?? [];
    ids.push(item.id);
    groups.set(accelerator, ids);
  }
  return new Set(
    [...groups.values()].filter((ids) => ids.length > 1).flat(),
  );
}

/** Normalizes the accelerator. */
export function normalizeAccelerator(accelerator: string): string {
  const isMac = isMacPlatform();
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => {
      const aliases: Record<string, string> = {
        commandorcontrol: isMac ? 'command' : 'control',
        cmdorctrl: isMac ? 'command' : 'control',
        cmd: 'command',
        ctrl: 'control',
        option: 'alt',
        super: isMac ? 'command' : 'super',
        arrowleft: 'left',
        arrowright: 'right',
        arrowup: 'up',
        arrowdown: 'down',
        return: 'enter',
        esc: 'escape',
        comma: ',',
        space: ' ',
        spacebar: ' ',
      };
      return aliases[part] ?? part;
    });
  const key = parts.pop();
  if (!key) return '';
  const modifierOrder = ['command', 'control', 'alt', 'shift', 'super'];
  const modifiers = parts.sort(
    (left, right) =>
      modifierOrder.indexOf(left) - modifierOrder.indexOf(right),
  );
  return [...modifiers, key].join('+');
}

/** Creates the accelerator. */
export function createAccelerator(event: KeyboardEvent<HTMLInputElement>): string {
  const isMac = isMacPlatform();
  const modifiers: string[] = [];
  if (event.metaKey) modifiers.push(isMac ? 'Command' : 'Super');
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push(isMac ? 'Option' : 'Alt');
  if (event.shiftKey) modifiers.push('Shift');

  if (isModifierKey(event.key)) return modifiers.join('+');

  let key = event.key;
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  else {
    const aliases: Record<string, string> = {
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ' ': 'Space',
      ',': 'Comma',
    };
    key = aliases[key] ?? key;
  }
  return [...modifiers, key].join('+');
}

/** Formats the accelerator. */
export function formatAccelerator(accelerator: string): string[] {
  const isMac = isMacPlatform();
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      const labels: Record<string, string> = isMac
        ? {
          commandorcontrol: '⌘',
          cmdorctrl: '⌘',
          command: '⌘',
          cmd: '⌘',
          control: '⌃',
          ctrl: '⌃',
          alt: '⌥',
          option: '⌥',
          shift: '⇧',
          super: '⌘',
        }
        : {
          commandorcontrol: 'Ctrl',
          cmdorctrl: 'Ctrl',
          command: 'Win',
          cmd: 'Win',
          control: 'Ctrl',
          ctrl: 'Ctrl',
          alt: 'Alt',
          option: 'Alt',
          shift: 'Shift',
          super: 'Win',
        };
      if (labels[normalized]) return labels[normalized];
      if (normalized === 'comma') return ',';
      if (normalized === 'space' || normalized === 'spacebar') return 'Space';
      if (part.length === 1) return part.toUpperCase();
      return part;
    });
}

/** Determines whether the modifier key condition applies. */
export function isModifierKey(key: string): boolean {
  return ['Meta', 'Control', 'Alt', 'Shift'].includes(key);
}

/** Determines whether the mac platform condition applies. */
export function isMacPlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}
