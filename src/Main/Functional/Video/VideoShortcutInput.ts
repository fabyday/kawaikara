import type { Input } from 'electron';
import { VIDEO_SHORTCUTS } from '../../../Common/VideoControls';
import { matchesAccelerator } from '../Shortcut/Accelerator';

/**
 * Determines whether internal Video should receive a configured playback/timeline key.
 * @param input - Native event before generic application shortcut matching.
 * @param overrides - Saved shortcut accelerators; empty overrides disable the corresponding key.
 * @returns True for a configured Video key, also allowing Control/Alt precision variants.
 * @remarks This only identifies renderer-owned input. It neither executes a Video action
 * nor consumes the DOM event; application input routing must delegate matching keys.
 */
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
        if (input.control) variants.push({ ...input, control: false });
        if (input.alt) variants.push({ ...input, alt: false });
        if (input.control && input.alt) {
            variants.push({ ...input, control: false, alt: false });
        }
        return variants.some((variant) =>
            matchesAccelerator(variant, accelerator),
        );
    });
}
