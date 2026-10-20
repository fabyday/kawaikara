import type { PreferenceManager } from '../../Manager/PreferenceManager';
import type { ProviderManager } from '../../Manager/ProviderManager';
import { ShortcutManager } from '../../Manager/ShortcutManager';
import { createProviderShortcutBindings } from '../Bundle/Provider/ProviderShortcuts';
import { createShortFormShortcutBindings } from '../Bundle/Provider/ShortFormShortcuts';
import { matchesVideoShortcutInput } from '../Video/VideoShortcutInput';
import type { ViewerRuntime } from '../Viewer/ViewerRuntime';
import { createViewerShortcutBindings } from '../Viewer/ViewerShortcuts';

/**
 * Connects feature-owned actions to a generic shortcut dispatcher.
 * @param sites - Provider catalog, current capabilities and action routing.
 * @param viewerRuntime - Native-window and presentation owners used by viewer shortcuts.
 * @param preferences - Persisted shortcut overrides and feature settings.
 * @returns The dispatcher; startup must refresh globals and dispose it during teardown.
 * @remarks Feature state is read at dispatch/refresh time. Binding precedence remains
 * viewer actions, short-form actions, active Provider actions, then Provider selection.
 */
export function createApplicationShortcuts(
    sites: ProviderManager,
    viewerRuntime: Pick<ViewerRuntime, 'pip' | 'site' | 'viewer' | 'windows'>,
    preferences: PreferenceManager,
): ShortcutManager {
    const viewerBindings = createViewerShortcutBindings(
        viewerRuntime,
        preferences,
    );
    return new ShortcutManager({
        /** Reads current overrides without caching a preference draft. */
        getOverrides: () => preferences.get().shortcuts,
        /** Re-evaluates current Provider capabilities and global eligibility. */
        getBindings: () => {
            const provider = createProviderShortcutBindings(sites, () =>
                viewerRuntime.viewer.hideOverlay(),
            );
            return [
                ...viewerBindings(),
                ...createShortFormShortcutBindings(
                    sites,
                    preferences,
                    viewerRuntime.pip.isPictureInPictureActive(),
                ),
                ...provider.actions,
                ...provider.selection,
            ];
        },
        /** Routes feature-owned keys before generic matching. */
        routeInput: (input) => {
            if (
                viewerRuntime.pip.isPictureInPictureActive() &&
                input.key.toLowerCase() === 'tab'
            )
                return true;
            if (
                sites.isCurrentSite('kawaikara.video') &&
                matchesVideoShortcutInput(input, preferences.get().shortcuts)
            )
                return false;
            return undefined;
        },
    });
}
