import { APP_SHORTCUTS } from '../../../Common/AppShortcuts';
import type { PreferenceManager } from '../../Manager/PreferenceManager';
import type { ShortcutBinding } from '../Shortcut/ShortcutBinding';
import type { ViewerRuntime } from './ViewerRuntime';

/**
 * Creates viewer action handlers with shared debounce and PiP concurrency guards.
 * @param viewerRuntime - Presentation, native-window, navigation and PiP capabilities.
 * @param preferences - Preference reader/writer used by always-on-top toggling.
 * @returns A source of current bindings; create it once per application runtime.
 * @remarks PiP eligibility is read when bindings are requested. Debounce and pending
 * transition state belong to these actions, independent of local/global dispatch.
 */
export function createViewerShortcutBindings(
    viewerRuntime: Pick<ViewerRuntime, 'pip' | 'site' | 'viewer' | 'windows'>,
    preferences: Pick<PreferenceManager, 'get' | 'update'>,
): () => ShortcutBinding[] {
    let lastAlwaysOnTopToggleAt = 0;
    let lastPictureInPictureToggleAt = 0;
    let pictureInPictureTogglePromise: Promise<void> | undefined;
    /** Persists and applies the requested native topmost state. */
    async function toggleAlwaysOnTop(): Promise<void> {
        const now = Date.now();
        if (now - lastAlwaysOnTopToggleAt < 250) return;
        lastAlwaysOnTopToggleAt = now;

        const current = preferences.get();
        const next = await preferences.update({
            alwaysOnTop: !current.alwaysOnTop,
        });
        viewerRuntime.windows.setAlwaysOnTop(next.alwaysOnTop);
    }
    /** Coalesces overlapping local/global PiP requests. */
    function togglePictureInPicture(): Promise<void> {
        if (pictureInPictureTogglePromise) {
            return pictureInPictureTogglePromise;
        }
        const now = Date.now();
        if (now - lastPictureInPictureToggleAt < 300) {
            return Promise.resolve();
        }
        lastPictureInPictureToggleAt = now;

        const operation = viewerRuntime.pip
            .togglePictureInPicture()
            .then(() => undefined);
        pictureInPictureTogglePromise = operation;
        /** Clears the operation. */
        const clear = () => {
            if (pictureInPictureTogglePromise === operation) {
                pictureInPictureTogglePromise = undefined;
            }
        };
        void operation.then(clear, clear);
        return operation;
    }
    const actions: Record<string, () => void | Promise<void>> = {
        'app.toggle-menu': () => viewerRuntime.viewer.toggleOverlay(),
        'app.toggle-fullscreen': () =>
            viewerRuntime.windows.toggleAppFullScreen(),
        'app.open-preferences': () =>
            viewerRuntime.viewer.showPreferencesOverlay(),
        'app.toggle-always-on-top': toggleAlwaysOnTop,
        'app.toggle-picture-in-picture': togglePictureInPicture,
        'app.reload-site': () => viewerRuntime.viewer.reloadViewer(),
        'app.go-back': () => {
            viewerRuntime.site.goBack();
        },
        'app.go-forward': () => {
            viewerRuntime.site.goForward();
        },
    };
    return () =>
        APP_SHORTCUTS.filter((definition) =>
            Boolean(actions[definition.id]),
        ).map((definition) => ({
            ...definition,
            allowWhileEditing: definition.id !== 'app.toggle-menu',
            global:
                definition.id === 'app.toggle-always-on-top' ||
                (definition.id === 'app.toggle-picture-in-picture' &&
                    viewerRuntime.pip.isPictureInPictureActive()),
            run: actions[definition.id],
        }));
}
