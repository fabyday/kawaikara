import { ownEventConnections } from '../EventConnections';
import type { UnifiedPictureInPictureState } from './PictureInPictureRuntime';

/** Lifecycle decisions supplied by the owner of the PiP session. */
export interface PictureInPictureWindowEvents {
    /** Reports whether this session may still issue lifecycle requests. */
    isCurrent(): boolean;
    /** Interrupts automatic movement when native resizing starts. */
    resizeStarted(): void;
    /** Updates retained content bounds. */
    resized(): void;
    /** Reasserts platform presentation after focus loss. */
    blurred(): void;
    /** Reports an ignored remote-document close request. */
    closeBlocked(): void;
    /** Handles unexpected native destruction. */
    closed(): void;
}

/**
 * Connects native PiP events to the current session's lifecycle operations.
 *
 * @param state - Session owning the native PiP window and its keyboard listener.
 * @param events - Owner callbacks; isCurrent is checked before handling close/destruction requests.
 * @returns An idempotent disposer for this connection's native-window and input listeners.
 * @throws If listener installation fails; earlier registrations from this call are rolled back.
 * @remarks An active page-originated close request is prevented. Native destruction
 * removes window listeners, while renderer destruction removes input listeners. The
 * session owner must also call the returned disposer on exit and failed entry.
 * Unrelated subscriptions are preserved.
 */
export function bindPictureInPictureWindowEvents(
    state: UnifiedPictureInPictureState,
    events: PictureInPictureWindowEvents,
): () => void {
    const disposeWindow = ownEventConnections(state.pipWindow, 'closed', () => {
        state.pipWindow.on('will-resize', events.resizeStarted);
        state.pipWindow.on('resize', events.resized);
        state.pipWindow.on('blur', events.blurred);
        state.pipWindow.on('close', (event) => {
            if (!events.isCurrent()) return;
            // Page-world window.close() cannot terminate the application-owned session.
            event.preventDefault();
            events.closeBlocked();
        });
        state.pipWindow.on('closed', () => {
            if (events.isCurrent()) events.closed();
        });
    });
    try {
        const disposeInput = ownEventConnections(
            state.pipWindow.webContents,
            'destroyed',
            () => {
                state.pipWindow.webContents.on(
                    'before-input-event',
                    state.inputListener,
                );
            },
        );
        return () => {
            disposeWindow();
            disposeInput();
        };
    } catch (error) {
        disposeWindow();
        throw error;
    }
}
