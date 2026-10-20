import type { EventEmitter } from 'node:events';

/**
 * Captures synchronous registrations on one emitter and owns only those listeners.
 *
 * @param emitter - Native window or renderer emitter whose registrations are scoped.
 * @param ended - Lifetime-ending event that automatically releases this scope.
 * @param connect - Synchronous registration callback; do not defer subscriptions to a promise or timer.
 * @returns An idempotent disposer that preserves listeners present before connect ran.
 * @throws The original setup error after registrations made by connect are removed.
 * @remarks Ownership is determined by comparing listener snapshots, including once wrappers.
 * This does not own handlers registered through other APIs or on other emitters;
 * those need their own scopes. Call dispose explicitly when retiring a still-live host.
 */
export function ownEventConnections(
    emitter: EventEmitter,
    ended: 'closed' | 'destroyed',
    connect: () => void,
): () => void {
    const previous = new Map(
        emitter.eventNames().map((name) => [name, emitter.rawListeners(name)]),
    );
    let disposed = false;
    /** Removes only listeners installed by this connection, including once wrappers. */
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        for (const [name, listeners] of owned)
            for (const listener of listeners)
                emitter.removeListener(
                    name,
                    listener as (...args: unknown[]) => void,
                );
        emitter.removeListener(ended, dispose);
    };
    let failure: unknown;
    let failed = false;
    try {
        connect();
    } catch (error) {
        failed = true;
        failure = error;
    }
    const owned = emitter.eventNames().map((name) => {
        const remaining = [...(previous.get(name) ?? [])];
        return [
            name,
            emitter.rawListeners(name).filter((listener) => {
                const index = remaining.indexOf(listener);
                if (index < 0) return true;
                remaining.splice(index, 1);
                return false;
            }),
        ] as const;
    });
    if (failed) {
        dispose();
        throw failure;
    }
    emitter.once(ended, dispose);
    return dispose;
}
