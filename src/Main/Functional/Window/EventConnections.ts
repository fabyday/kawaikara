import type { EventEmitter } from 'node:events';

/** Captures synchronous event registrations and releases only this connection's listeners. */
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
