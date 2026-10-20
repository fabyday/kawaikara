import { getPrimaryShortcutModifier } from '../../Platform/Keyboard';
import type { Input } from 'electron';

/**
 * Compares a native keyboard event with an Electron accelerator.
 * @param input - Event key/code and modifier state; physical letter/digit codes take precedence.
 * @param accelerator - Plus-delimited key with supported modifier aliases.
 * @returns True only when the key and every modifier match exactly.
 * @remarks CommandOrControl resolves through Platform keyboard policy. This function
 * does not filter event type, composing input, repetition or editor focus; the dispatcher
 * applies those policies before or after matching. Unknown modifiers do not match.
 */
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
                if (getPrimaryShortcutModifier() === 'meta') needsMeta = true;
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
    if (/^Key[A-Z]$/i.test(input.code))
        return input.code.slice(3).toLowerCase();
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
