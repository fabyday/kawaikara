import {
    SHORT_FORM_VIDEO_ACTIONS,
    type ProviderSettingListItem,
    type ShortFormVideoDescriptor,
} from '@kawaikara/site-api';
import { SHORT_FORM_VIDEO_SHORTCUTS } from '../../../../Common/ShortFormVideo';
import type { ProviderManager } from '../../../Manager/ProviderManager';
import type { PreferenceManager } from '../../../Manager/PreferenceManager';
import type { ShortcutBinding } from '../../Shortcut/ShortcutBinding';

/** Provider capabilities used by the short-form action adapter. */
type ShortFormProviders = Pick<
    ProviderManager,
    | 'getCurrentSiteId'
    | 'getCurrentShortFormVideoDescriptor'
    | 'getCurrentShortFormVideoPublisher'
    | 'handleAction'
    | 'applyCurrentProviderSettings'
>;
/** Settings access owned by the application, not the shortcut dispatcher. */
type ShortFormPreferences = Pick<PreferenceManager, 'get' | 'update'>;

/**
 * Creates bindings only for capabilities declared by the current Provider.
 * @param sites - Current Provider capabilities and action dispatch.
 * @param preferences - Persisted settings access for auto-advance and publisher filtering.
 * @param globalActive - Whether these currently eligible actions should be OS-global.
 * @returns Feature-owned handlers; previous/next may repeat, settings changes may not.
 * @remarks Stale bindings do not act after a switch to a different Provider. Publisher
 * lookup is asynchronous and rechecks the Provider before writing its ban settings.
 */
export function createShortFormShortcutBindings(
    sites: ShortFormProviders,
    preferences: ShortFormPreferences,
    globalActive: boolean,
): ShortcutBinding[] {
    const siteId = sites.getCurrentSiteId();
    const descriptor = sites.getCurrentShortFormVideoDescriptor();
    if (!siteId || !descriptor) return [];
    return SHORT_FORM_VIDEO_SHORTCUTS.filter((definition) =>
        supportsShortFormShortcut(definition.id, descriptor),
    ).map((definition) => ({
        ...definition,
        repeatable: isRepeatableShortFormNavigationShortcut(definition.id),
        allowWhileEditing: true,
        global: globalActive,
        run: () =>
            sites.getCurrentSiteId() === siteId
                ? runShortFormAction(sites, preferences, definition.id)
                : undefined,
    }));
}

/** Determines whether the repeatable short form navigation shortcut condition applies. */
function isRepeatableShortFormNavigationShortcut(shortcutId: string): boolean {
    return (
        shortcutId === 'short-form-video.previous' ||
        shortcutId === 'short-form-video.next'
    );
}

/** Performs the supports short form shortcut operation. */
function supportsShortFormShortcut(
    shortcutId: string,
    descriptor: ShortFormVideoDescriptor,
): boolean {
    if (shortcutId === 'short-form-video.previous')
        return descriptor.previous === true;
    if (shortcutId === 'short-form-video.next') return descriptor.next === true;
    if (shortcutId === 'short-form-video.toggle-auto-advance') {
        return Boolean(descriptor.autoAdvance);
    }
    if (shortcutId === 'short-form-video.ban-current-publisher') {
        return Boolean(descriptor.publisherBan);
    }
    return false;
}

/**
 * Dispatches the current Provider's declared short-form operation.
 * @param sites - Capability lookup and permission-aware Provider dispatch.
 * @param preferences - Current settings and persistence operations.
 * @param shortcutId - Short-form definition ID; unsupported IDs/capabilities do nothing.
 * @returns Completion of navigation or persisted settings application and announcement.
 * @remarks Auto-advance changes respect the declared default. Provider identity is
 * checked after persistence before applying settings or announcing to the current page.
 */
async function runShortFormAction(
    sites: ShortFormProviders,
    preferences: ShortFormPreferences,
    shortcutId: string,
): Promise<void> {
    const siteId = sites.getCurrentSiteId();
    const descriptor = sites.getCurrentShortFormVideoDescriptor();
    if (!siteId || !descriptor) return;

    if (shortcutId === 'short-form-video.previous' && descriptor.previous) {
        await sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.previous);
        return;
    }
    if (shortcutId === 'short-form-video.next' && descriptor.next) {
        await sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.next);
        return;
    }

    if (shortcutId === 'short-form-video.ban-current-publisher') {
        await banCurrentShortFormPublisher(
            sites,
            preferences,
            siteId,
            descriptor,
        );
        return;
    }

    if (
        shortcutId !== 'short-form-video.toggle-auto-advance' ||
        !descriptor.autoAdvance
    ) {
        return;
    }

    const current = preferences.get();
    const providerSettings = { ...current.providerSettings };
    const settings = { ...(providerSettings[siteId] ?? {}) };
    const { defaultValue, settingKey } = descriptor.autoAdvance;
    const currentValue = settings[settingKey];
    settings[settingKey] =
        typeof currentValue === 'boolean' ? !currentValue : !defaultValue;
    providerSettings[siteId] = settings;
    await preferences.update({ providerSettings });
    if (sites.getCurrentSiteId() !== siteId) return;
    await sites.applyCurrentProviderSettings();
    if (sites.getCurrentSiteId() !== siteId) return;
    await sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.announceAutoAdvance);
}

/**
 * Adds or enriches a publisher filter entry for the Provider that originated the action.
 * @param sites - Active Provider identity, publisher lookup and action callbacks.
 * @param preferences - Stored settings and persistence operations.
 * @param siteId - Captured Provider ID; a different current ID cancels late work.
 * @param descriptor - Declares the filter setting key and optional next-navigation support.
 * @returns Completion of persistence and application, or no-op for missing/stale publisher data.
 * @remarks A new ban relies on Provider settings refresh to skip the blocked item;
 * it must not also send next. An unchanged existing ban may advance once. Errors from
 * persistence or Provider actions propagate to the shortcut dispatcher's error handling.
 */
async function banCurrentShortFormPublisher(
    sites: ShortFormProviders,
    preferences: ShortFormPreferences,
    siteId: string,
    descriptor: ShortFormVideoDescriptor,
): Promise<void> {
    const settingKey = descriptor.publisherBan?.settingKey;
    if (!settingKey) return;
    const publisher = await sites.getCurrentShortFormVideoPublisher();
    if (sites.getCurrentSiteId() !== siteId || !publisher?.id.trim()) return;

    const current = preferences.get();
    const providerSettings = { ...current.providerSettings };
    const settings = { ...(providerSettings[siteId] ?? {}) };
    const existing = Array.isArray(settings[settingKey])
        ? (settings[settingKey] as readonly ProviderSettingListItem[])
        : [];
    const nextItem: ProviderSettingListItem = {
        id: publisher.id,
        label: publisher.label || publisher.id,
        description: publisher.handle,
        imageUrl: publisher.imageUrl,
    };
    const existingIndex = existing.findIndex(
        (item) => item.id === publisher.id,
    );
    const shouldEnrichExisting =
        existingIndex >= 0 &&
        Boolean(
            (publisher.imageUrl && !existing[existingIndex]?.imageUrl) ||
            (publisher.handle && !existing[existingIndex]?.description),
        );
    if (existingIndex < 0 || shouldEnrichExisting) {
        settings[settingKey] =
            existingIndex < 0
                ? [...existing, nextItem]
                : existing.map((item, index) =>
                      index === existingIndex
                          ? {
                                ...item,
                                label: publisher.label || item.label,
                                description:
                                    publisher.handle ?? item.description,
                                imageUrl: publisher.imageUrl ?? item.imageUrl,
                            }
                          : item,
                  );
        providerSettings[siteId] = settings;
        await preferences.update({ providerSettings });
        if (sites.getCurrentSiteId() !== siteId) return;
        await sites.applyCurrentProviderSettings();
        if (sites.getCurrentSiteId() !== siteId) return;
        if (existingIndex < 0) {
            await sites.handleAction(
                SHORT_FORM_VIDEO_ACTIONS.announcePublisherBan,
            );
        }
    }
    // Applying a newly added ban refreshes the Provider and makes it skip the
    // now-blocked current publisher. Sending `next` as well used to skip both
    // the blocked Short and the following valid Short.
    if (descriptor.next && existingIndex >= 0 && !shouldEnrichExisting) {
        await sites.handleAction(SHORT_FORM_VIDEO_ACTIONS.next);
    }
}
