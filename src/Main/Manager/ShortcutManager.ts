import { globalShortcut, type Input } from 'electron';
import { matchesAccelerator } from '../Functional/Shortcut/Accelerator';
import type {
    ShortcutBinding,
    ShortcutSource,
} from '../Functional/Shortcut/ShortcutBinding';

/** Matches and dispatches feature-supplied shortcuts without interpreting their actions. */
export class ShortcutManager {
    /** Global registrations owned by this manager, keyed by stable binding ID. */
    private readonly registered = new Map<string, string>();
    /** Disposal suspends dispatch until an explicit refresh, such as failed-update recovery. */
    private suspended = false;

    /**
     * Creates a dispatcher without registering OS shortcuts yet.
     * @param source - Live binding, override and routing callbacks owned by application composition.
     * @remarks Definitions must have unique IDs. Feature permissions and action semantics
     * belong to the supplied handlers, not this manager.
     */
    constructor(private readonly source: ShortcutSource) {}

    /**
     * Matches local input and invokes the first eligible handler.
     * @param input - Electron key event; composition and non-key-down events are ignored.
     * @param editing - Whether an editor currently owns input, false by default.
     * @returns True when consumed, including dispatched actions that later fail.
     * @remarks Repetition and editing eligibility come from binding metadata. Routing may
     * reserve an event or delegate it to the renderer before matching begins.
     */
    handleInput(input: Input, editing = false): boolean {
        if (this.suspended || input.type !== 'keyDown' || input.isComposing)
            return false;
        const routed = this.source.routeInput?.(input, editing);
        if (routed !== undefined) return routed;
        const overrides = this.source.getOverrides();
        const binding = this.source.getBindings().find((candidate) => {
            const accelerator = this.accelerator(candidate, overrides);
            return accelerator !== '' && matchesAccelerator(input, accelerator);
        });
        if (
            !binding ||
            (input.isAutoRepeat && !binding.repeatable) ||
            (editing && !binding.allowWhileEditing)
        )
            return false;
        this.dispatch(binding);
        return true;
    }

    /**
     * Reconciles OS-global registrations against current definitions and overrides.
     * @remarks Only registrations owned by this manager are removed. The first eligible
     * binding wins a duplicate accelerator; externally owned accelerators are left alone.
     * Call after relevant feature state or preferences change. Also resumes dispatch after dispose().
     */
    refreshGlobalShortcut(): void {
        this.suspended = false;
        const overrides = this.source.getOverrides();
        const desired = new Map<string, string>();
        const claimed = new Set<string>();
        for (const binding of this.source.getBindings()) {
            const accelerator = this.accelerator(binding, overrides);
            if (!binding.global || !accelerator || claimed.has(accelerator))
                continue;
            desired.set(binding.id, accelerator);
            claimed.add(accelerator);
        }
        for (const [id, accelerator] of this.registered) {
            if (
                desired.get(id) === accelerator &&
                globalShortcut.isRegistered(accelerator)
            )
                continue;
            if (globalShortcut.isRegistered(accelerator))
                globalShortcut.unregister(accelerator);
            this.registered.delete(id);
        }
        for (const [id, accelerator] of desired) {
            if (
                this.registered.get(id) === accelerator ||
                globalShortcut.isRegistered(accelerator)
            )
                continue;
            try {
                const registered = globalShortcut.register(accelerator, () => {
                    if (this.suspended) return;
                    // Resolve again so a retired feature or changed override cannot execute a stale handler.
                    const binding = this.source
                        .getBindings()
                        .find((entry) => entry.id === id);
                    if (
                        !binding?.global ||
                        this.accelerator(
                            binding,
                            this.source.getOverrides(),
                        ) !== accelerator
                    )
                        return;
                    this.dispatch(binding);
                });
                if (registered) this.registered.set(id, accelerator);
                else
                    console.warn(
                        `Global shortcut ${id} could not be registered: ${accelerator}`,
                    );
            } catch (error) {
                console.warn(
                    `Global shortcut ${id} is invalid or unavailable: ${accelerator}`,
                    error,
                );
            }
        }
    }

    /** Releases owned global shortcuts and suspends dispatch; safe to call repeatedly. */
    dispose(): void {
        this.suspended = true;
        for (const accelerator of this.registered.values()) {
            if (globalShortcut.isRegistered(accelerator))
                globalShortcut.unregister(accelerator);
        }
        this.registered.clear();
    }

    /** Resolves explicit overrides, including disabled empty strings. */
    private accelerator(
        binding: ShortcutBinding,
        overrides: Readonly<Record<string, string>>,
    ): string {
        return (overrides[binding.id] ?? binding.defaultKey).trim();
    }

    /** Contains handler failures from both synchronous callbacks and returned promises. */
    private dispatch(binding: ShortcutBinding): void {
        try {
            void Promise.resolve(binding.run()).catch((error: unknown) => {
                console.error(`Shortcut ${binding.id} failed.`, error);
            });
        } catch (error) {
            console.error(`Shortcut ${binding.id} failed.`, error);
        }
    }
}
