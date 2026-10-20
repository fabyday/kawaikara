import type { BundleDefinition } from '@kawaikara/site-api';
import type {
    BrowserProfileInfo,
    PreferenceState,
} from '../../../../Common/IPC';
import {
    createIsolatedRuntime,
    createPluginBrowserProfileId,
    createSharedRuntime,
    type RegisteredProvider,
    type SiteRuntimeProfile,
} from './SiteRuntime';

/**
 * Validates Bundle-local browser profiles and qualifies their runtime identifiers.
 *
 * @param bundle - Loaded Bundle whose optional browserProfiles declarations are enumerated.
 * @returns Profile descriptions using Bundle-qualified IDs, trimmed names and persistent
 * storage by default. An absent declaration produces an empty array.
 * @throws When a local ID is malformed or duplicated, or a display name is empty or too long.
 * @remarks Cross-Bundle collisions are checked by registration staging. No browser
 * Session or on-disk partition is created by this function.
 */
export function createBundleBrowserProfiles(
    bundle: BundleDefinition,
): BrowserProfileInfo[] {
    const localIds = new Set<string>();
    return (bundle.browserProfiles ?? []).map((profile) => {
        const id = profile.id.trim();
        const name = profile.name.trim();
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) {
            throw new Error(
                `Bundle ${bundle.id} has invalid browser profile id ${id}.`,
            );
        }
        if (!name || name.length > 80 || localIds.has(id)) {
            throw new Error(
                `Bundle ${bundle.id} has an invalid or duplicate profile ${id}.`,
            );
        }
        localIds.add(id);
        return {
            id: createPluginBrowserProfileId(bundle.id, id),
            name,
            description: profile.description,
            persistent: profile.persistent !== false,
            source: 'plugin',
            pluginId: bundle.id,
            pluginName: bundle.name ?? bundle.id,
        };
    });
}

/**
 * Looks up a qualified user or Bundle browser profile.
 *
 * @param id - Qualified plugin: or user: profile identifier.
 * @param preferences - Preference snapshot containing user-created profiles.
 * @param profiles - Registered Bundle-owned profiles keyed by qualified identifier.
 * @returns The matching profile, or undefined for a missing/unsupported identifier.
 * @remarks Bundle profile records may be returned by reference. Callers must not mutate them.
 */
export function findBrowserProfile(
    id: string,
    preferences: PreferenceState,
    profiles: ReadonlyMap<string, BrowserProfileInfo>,
): BrowserProfileInfo | undefined {
    if (id.startsWith('plugin:')) return profiles.get(id);
    if (!id.startsWith('user:')) return undefined;
    const userId = id.slice('user:'.length);
    const profile = preferences.browserProfiles.find(
        (item) => item.id === userId,
    );
    return profile
        ? {
              /** The ID value. */
              id,
              /** The name value. */
              name: profile.name,
              /** The persistent value. */
              persistent: profile.persistent,
              /** The source value. */
              source: 'user',
          }
        : undefined;
}

/**
 * Selects the storage runtime for a Provider using the current profile assignment.
 *
 * @param registration - Provider metadata and owning Bundle identifier.
 * @param preferences - Current per-Provider assignments and user-created profiles.
 * @param profiles - Available Bundle-owned profiles keyed by qualified identifier.
 * @returns An isolated runtime for an explicit isolated assignment; otherwise the valid
 * assigned profile, then the declared Bundle default, then an isolated fallback.
 * @remarks A missing saved assignment falls through without modifying preferences.
 * This resolves partition identity only; it does not create a Session or reload a site.
 */
export function resolveProviderBrowserProfile(
    registration: RegisteredProvider,
    preferences: PreferenceState,
    profiles: ReadonlyMap<string, BrowserProfileInfo>,
): SiteRuntimeProfile {
    const assigned = preferences.siteBrowserProfiles[registration.metadata.id];
    if (assigned === 'isolated')
        return createIsolatedRuntime(registration.metadata.id);

    const selected = assigned
        ? findBrowserProfile(assigned, preferences, profiles)
        : undefined;
    if (selected)
        return createSharedRuntime(registration.metadata.id, selected);

    const defaultProfile =
        registration.metadata.isolation?.defaultBrowserProfile;
    if (defaultProfile) {
        const profile = profiles.get(
            createPluginBrowserProfileId(registration.bundleId, defaultProfile),
        );
        if (profile)
            return createSharedRuntime(registration.metadata.id, profile);
    }
    return createIsolatedRuntime(registration.metadata.id);
}

/**
 * Enumerates known storage partitions for browser-data operations.
 *
 * @param providers - Registered Providers, including inactive ones.
 * @param preferences - Current profile assignments and user-created profiles.
 * @param profiles - Registered Bundle-owned browser profiles.
 * @returns Unique partition names covering resolved Provider runtimes, each Provider's
 * isolated partition and all registered/user profiles.
 * @remarks Does not query disk for unknown partitions or clear any data. The caller
 * must suspend an active partition before a destructive storage operation.
 */
export function listProviderBrowserDataPartitions(
    providers: Iterable<RegisteredProvider>,
    preferences: PreferenceState,
    profiles: ReadonlyMap<string, BrowserProfileInfo>,
): string[] {
    const partitions = new Set<string>();
    for (const registration of providers) {
        partitions.add(
            resolveProviderBrowserProfile(registration, preferences, profiles)
                .partition,
        );
        partitions.add(
            createIsolatedRuntime(registration.metadata.id).partition,
        );
    }
    for (const profile of profiles.values()) {
        partitions.add(createSharedRuntime('', profile).partition);
    }
    for (const profile of preferences.browserProfiles) {
        const resolved = findBrowserProfile(
            `user:${profile.id}`,
            preferences,
            profiles,
        );
        if (resolved)
            partitions.add(createSharedRuntime('', resolved).partition);
    }
    return [...partitions];
}
