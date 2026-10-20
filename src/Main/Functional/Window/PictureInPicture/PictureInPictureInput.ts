import type { UnifiedPictureInPictureState } from './PictureInPictureRuntime';
import {
    isPointInside,
    resolveGlobalMousePoint,
} from './PictureInPictureRuntime';
import {
    PIP_RETURN_BUTTON_BOUNDS,
    PIP_PLAYBACK_BUTTON_SIZE,
} from './PictureInPictureConstants';

/** Semantic operations requested by native pointer input. */
export interface PictureInPicturePointerActions {
    /** Dispatches a trusted control action. */
    activate(action: 'restore' | 'playback'): void;
    /** Stops automatic movement before a user drag begins. */
    interruptResize(): void;
    /** Applies the deferred video shape after releasing a drag. */
    updateAspectRatio(ratio: number): void;
}

/**
 * Interprets PiP pointer gestures as control actions, window dragging and deferred resizing.
 *
 * @param state - Mutable session state containing the native window, control visibility,
 * drag position and pending aspect-ratio information.
 * @param input - Native mouse input; unsupported events and closing/destroyed sessions are ignored.
 * @param actions - Semantic callbacks for playback/restore and interruption/resumption of resizing.
 * @remarks Uses WebContents-relative coordinates for control hit testing and global
 * coordinates for dragging. Mutates drag/deferred-resize state and may move the native
 * window. Permission and active-session checks for actions remain with the owner.
 */
export function handlePictureInPicturePointerInput(
    state: UnifiedPictureInPictureState,
    input: Electron.InputEvent,
    actions: PictureInPicturePointerActions,
): void {
    if (state.closing || state.pipWindow.isDestroyed()) return;
    if (
        input.type !== 'mouseDown' &&
        input.type !== 'mouseMove' &&
        input.type !== 'mouseUp' &&
        input.type !== 'mouseLeave'
    ) {
        return;
    }

    const mouseInput = input as Electron.MouseInputEvent;
    // Hover and drag must use the same WebContents-wide input surface. A
    // CSS app-region inside a frequently replaced CHZZK iframe can remain
    // visually present while no longer participating in native hit testing.
    state.controlsVisibility?.sync();
    if (input.type === 'mouseDown') {
        if (mouseInput.button && mouseInput.button !== 'left') return;
        if (
            state.controlsVisible &&
            isPointInside(mouseInput, PIP_RETURN_BUTTON_BOUNDS)
        ) {
            actions.activate('restore');
            return;
        }
        const [contentWidth, contentHeight] = state.pipWindow.getContentSize();
        if (
            state.controlsVisible &&
            isPointInside(mouseInput, {
                x: (contentWidth - PIP_PLAYBACK_BUTTON_SIZE) / 2,
                y: (contentHeight - PIP_PLAYBACK_BUTTON_SIZE) / 2,
                width: PIP_PLAYBACK_BUTTON_SIZE,
                height: PIP_PLAYBACK_BUTTON_SIZE,
            })
        ) {
            actions.activate('playback');
            return;
        }
        const interruptedAspectRatio = state.resizeAnimation?.targetAspectRatio;
        actions.interruptResize();
        if (interruptedAspectRatio !== undefined) {
            state.pendingAspectRatio = interruptedAspectRatio;
        }
        const cursor = resolveGlobalMousePoint(mouseInput);
        const [windowX, windowY] = state.pipWindow.getPosition();
        state.dragState = {
            cursorX: cursor.x,
            cursorY: cursor.y,
            windowX,
            windowY,
        };
        return;
    }

    if (input.type === 'mouseUp' || input.type === 'mouseLeave') {
        const drag = state.dragState;
        const released = state.pipWindow.getBounds();
        const moved =
            drag &&
            Math.hypot(released.x - drag.windowX, released.y - drag.windowY) >=
                3;
        state.dragState = undefined;
        const pendingAspectRatio = state.pendingAspectRatio;
        state.pendingAspectRatio = undefined;
        if (pendingAspectRatio !== undefined) {
            actions.updateAspectRatio(pendingAspectRatio);
        }
        if (input.type === 'mouseUp' && moved) {
            if (state.resizeAnimation) state.alignAfterResize = true;
            else state.alignment?.snap();
        }
        return;
    }

    const drag = state.dragState;
    if (!drag) return;
    const cursor = resolveGlobalMousePoint(mouseInput);
    state.pipWindow.setPosition(
        Math.round(drag.windowX + cursor.x - drag.cursorX),
        Math.round(drag.windowY + cursor.y - drag.cursorY),
        false,
    );
}

/**
 * Creates the native PiP keyboard adapter without subscribing it to a renderer.
 *
 * @param restore - Requests restoration of the main viewer for an unmodified Escape key-down.
 * @returns A before-input-event listener that consumes Tab and eligible Escape events.
 * @remarks Repeated, composing or modified Escape events do not restore the viewer.
 * The caller owns listener registration, removal and the session validity check.
 */
export function createPictureInPictureInputListener(
    restore: () => void,
): (event: Electron.Event, input: Electron.Input) => void {
    return (event, input) => {
        if (input.type === 'keyDown' && input.key.toLowerCase() === 'tab') {
            event.preventDefault();
            return;
        }
        if (
            input.type === 'keyDown' &&
            !input.isAutoRepeat &&
            !input.isComposing &&
            !input.control &&
            !input.meta &&
            !input.alt &&
            !input.shift &&
            input.key.toLowerCase() === 'escape'
        ) {
            event.preventDefault();
            restore();
        }
    };
}
