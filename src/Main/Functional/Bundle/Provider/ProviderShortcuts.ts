import type { ProviderManager } from '../../../Manager/ProviderManager';
import type { ShortcutBinding } from '../../Shortcut/ShortcutBinding';

/** Bindings grouped so composition can preserve action precedence over Provider selection. */
export interface ProviderShortcutBindings {
    /** Actions declared by the active Provider. */
    readonly actions: readonly ShortcutBinding[];
    /** Selection shortcuts for all registered Providers. */
    readonly selection: readonly ShortcutBinding[];
}

/**
 * Maps Provider metadata to selection and active-Provider action handlers.
 * @param sites - Current menu catalog, activation and permission-aware action dispatch.
 * @param hideOverlay - Hides the viewer menu before selecting a Provider.
 * @returns Grouped bindings without global registration; the dispatcher owns key matching.
 * @remarks Actions recheck active identity before dispatch. No Provider ID or site-specific
 * action is hard-coded here, so third-party descriptors follow the same path.
 */
export function createProviderShortcutBindings(
    sites: Pick<
        ProviderManager,
        'listMenuItems' | 'isCurrentSite' | 'load' | 'handleAction'
    >,
    hideOverlay: () => void,
): ProviderShortcutBindings {
    const items = sites.listMenuItems();
    return {
        /** Current Provider actions, guarded again when invoked. */
        actions: items
            .filter((site) => site.isCurrent)
            .flatMap((site) =>
                site.actionShortcuts.map((shortcut) => ({
                    ...shortcut,
                    allowWhileEditing: true,
                    run: async () => {
                        if (sites.isCurrentSite(site.id))
                            await sites.handleAction(shortcut.action);
                    },
                })),
            ),
        /** Application-wide Provider selection entries. */
        selection: items.map((site) => ({
            id: `site:${site.id}`,
            defaultKey: site.defaultShortcut,
            allowWhileEditing: true,
            run: async () => {
                hideOverlay();
                await sites.load(site.id);
            },
        })),
    };
}
