import type { Input } from 'electron';

/** A feature-owned action exposed to the generic shortcut dispatcher. */
export interface ShortcutBinding {
    /** Stable identity used for overrides and global-registration reconciliation. */
    readonly id: string;
    /** Default Electron accelerator; an empty value leaves this action unbound. */
    readonly defaultKey: string;
    /** Whether held key-down events may invoke the action; false by default. */
    readonly repeatable?: boolean;
    /** Whether the action may run in an editor; false by default. */
    readonly allowWhileEditing?: boolean;
    /** Whether this binding currently needs OS-global registration. */
    readonly global?: boolean;
    /** Executes the feature action; the dispatcher catches synchronous and asynchronous failures. */
    run(): void | Promise<void>;
}

/** Supplies live definitions and input routing without exposing feature managers. */
export interface ShortcutSource {
    /** Returns eligible definitions in local matching/global collision priority order. */
    getBindings(): readonly ShortcutBinding[];
    /** Reads saved accelerator overrides; empty strings explicitly disable a binding. */
    getOverrides(): Readonly<Record<string, string>>;
    /**
     * Optional pre-match routing. True consumes the event, false delegates to the renderer,
     * and undefined continues generic matching. Called only for non-composing key-down events.
     */
    routeInput?(input: Input, editing: boolean): boolean | undefined;
}
