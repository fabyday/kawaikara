import type { OverlayView } from '../../../Common/IPC';
import { ownEventConnections } from './EventConnections';
import type { Input, WebContents } from 'electron';
import { handleNativeEditingShortcut } from './WindowOperations';

/** Window actions interpreted before configurable application shortcuts. */
export type WindowInputAction = 'back' | 'toggle-menu' | 'toggle-playback';
/** Input ownership determines which built-in actions are available. */
export type WindowInputSurface =
    'overlay' | 'viewer' | 'video' | 'site' | 'devtools';
/** Live window state used to interpret a key without retaining stale UI state. */
export interface WindowInputState {
    /** Surface receiving this input. */
    surface: WindowInputSurface;
    /** Whether this surface currently accepts application input. */
    active: boolean;
    /** Whether focus is inside an editor. */
    editing: boolean;
    /** Visible application overlay, if any. */
    overlay?: OverlayView;
    /** Whether Escape may dismiss the menu. */
    closeMenuOnEscape: boolean;
    /** Whether the internal Video provider is active. */
    videoVisible: boolean;
    /** Whether Video is in a host without a menu. */
    videoPictureInPicture: boolean;
}
/** Input disposition, including events deliberately left to the renderer. */
export type WindowInputIntent =
    WindowInputAction | 'consume' | 'renderer' | 'shortcut';

/** Resolves built-in key policy independently of Electron event registration. */
export function resolveWindowInput(
    input: Input,
    state: WindowInputState,
): WindowInputIntent {
    if (!state.active || state.surface === 'devtools') return 'renderer';
    const down =
        input.type === 'keyDown' && !input.isAutoRepeat && !input.isComposing;
    const plain = !input.control && !input.meta && !input.alt && !input.shift;
    const key = input.key.toLowerCase();
    if (state.surface === 'overlay') {
        if (
            down &&
            (state.overlay === 'preference' ||
                state.overlay === 'update' ||
                state.overlay === 'external-app' ||
                state.overlay === 'external-app-permission')
        ) {
            if (key === 'tab' && state.overlay === 'preference')
                return 'consume';
            if (
                plain &&
                (key === 'escape' || (key === 'backspace' && !state.editing))
            )
                return 'back';
            return 'renderer';
        }
        if (down && plain && state.overlay === 'menu') {
            if (key === 'tab') return 'toggle-menu';
            if (key === 'escape' && state.closeMenuOnEscape && !state.editing)
                return 'back';
        }
        return state.editing ? 'renderer' : 'shortcut';
    }
    if (
        (state.surface === 'viewer' || state.surface === 'video') &&
        state.videoVisible &&
        down &&
        plain
    ) {
        if (key === 'tab')
            return state.videoPictureInPicture ? 'consume' : 'toggle-menu';
        if (
            !state.editing &&
            (input.code === 'Space' || key === ' ' || key === 'space')
        )
            return 'toggle-playback';
    }
    return 'shortcut';
}

/** Converts native browser buttons into directory navigation intent. */
export function resolveBrowserNavigation(
    command: string,
): 'back' | 'forward' | undefined {
    if (command === 'browser-backward') return 'back';
    if (command === 'browser-forward') return 'forward';
    return undefined;
}

/** Supplies state and actions without exposing ViewerRuntime to the adapter. */
export interface WindowInputBindings {
    /** Reads state for each event, including editor focus changes. */
    getState(): WindowInputState;
    /** Applies an interpreted window action. */
    dispatch(action: WindowInputAction): void;
    /** Delegates configurable keys to ShortcutManager's existing handler. */
    shortcut(input: Input, editing: boolean): boolean;
}

/** Binds native editing, built-in actions, and configurable shortcuts in priority order. */
export function bindWindowInput(
    contents: WebContents,
    bindings: WindowInputBindings,
): () => void {
    return ownEventConnections(contents, 'destroyed', () => {
        contents.on('before-input-event', (event, input) => {
            const state = bindings.getState();
            if (!state.active) return;
            if (handleNativeEditingShortcut(contents, input, state.editing)) {
                event.preventDefault();
                return;
            }
            const intent = resolveWindowInput(input, state);
            if (intent === 'renderer') return;
            if (intent === 'shortcut') {
                if (bindings.shortcut(input, state.editing))
                    event.preventDefault();
                return;
            }
            event.preventDefault();
            if (intent !== 'consume') bindings.dispatch(intent);
        });
    });
}
