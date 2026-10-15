/** Modifier used for standard native application shortcuts. */
export function getPrimaryShortcutModifier(): 'meta' | 'control' {
    return 'control';
}
/** Whether the native editing convention supports Control+Y for redo. */
export function supportsRedoWithY(): boolean {
    return true;
}
