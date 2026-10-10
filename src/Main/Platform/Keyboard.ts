/** Modifier used for the platform's standard application shortcuts. */
export function getPrimaryShortcutModifier(): 'meta' | 'control' {
    return process.platform === 'darwin' ? 'meta' : 'control';
}

/** Whether the standard editing menu supports Control+Y for redo. */
export function supportsRedoWithY(): boolean {
    return process.platform !== 'darwin';
}
