import {
    getProviderMetadata,
    type BundleDefinition,
    type ProviderDefinition,
} from '@kawaikara/site-api';
import type { BrowserProfileInfo } from '../../../../Common/IPC';
import { withPluginSettings } from '../Plugin/PluginDescriptors';
import { createPluginRegistration } from '../Plugin/PluginRegistration';
import { createBundleBrowserProfiles } from './ProviderBrowserProfiles';
import { resolveProviderLocaleDescriptors } from './ProviderLocale';
import {
    validateProviderDescriptors,
    type RegisteredBundle,
    type RegisteredProvider,
    type RegisteredRuntimePlugin,
} from './SiteRuntime';

/** Read-only registration state used to validate an entire Bundle before commit. */
export interface ProviderRegistrationRegistry {
    /** Existing Provider definitions. */
    readonly sites: ReadonlyMap<string, RegisteredProvider>;
    /** Existing Bundle definitions. */
    readonly bundles: ReadonlyMap<string, RegisteredBundle>;
    /** Existing Plugin definitions. */
    readonly plugins: ReadonlyMap<string, RegisteredRuntimePlugin>;
    /** Existing Bundle-owned browser profiles. */
    readonly browserProfiles: ReadonlyMap<string, BrowserProfileInfo>;
}

/** Fully validated data; only the manager commits it to the live registry. */
export interface PreparedBundleRegistration {
    /** Provider metadata after composing existing and incoming Plugin settings. */
    readonly composedProviders: readonly RegisteredProvider[];
    /** Newly registered Providers, used for drop discovery. */
    readonly providers: readonly RegisteredProvider[];
    /** Newly registered Plugins. */
    readonly plugins: readonly RegisteredRuntimePlugin[];
    /** Validated Bundle record and browser profiles. */
    readonly bundle: RegisteredBundle;
}

/**
 * Validates a complete Bundle and prepares its registry changes without committing them.
 *
 * @param bundle - Loaded Bundle definition, including Provider/Plugin manifests and constructors.
 * @param registry - Read-only view of currently committed identifiers, metadata and profiles.
 * @returns Validated new registrations plus effective metadata for all Providers affected
 * by incoming Plugin settings. The caller must commit the returned records together.
 * @throws When identifiers conflict, manifest/decorator contracts disagree, permissions
 * or profile references are invalid, or composed descriptors fail validation.
 * @remarks Does not read files, instantiate Providers/Plugins, mutate registry maps or
 * notify subscribers. Validation failure leaves existing registrations unchanged.
 * Call synchronously immediately before commit so the registry cannot change between
 * validation and insertion.
 */
export function prepareBundleRegistration(
    bundle: BundleDefinition,
    registry: ProviderRegistrationRegistry,
): PreparedBundleRegistration {
    if (!bundle.id.trim())
        throw new Error('A Bundle must have a non-empty id.');
    if (registry.bundles.has(bundle.id))
        throw new Error(`Bundle ${bundle.id} is already registered.`);
    if (bundle.providers.length === 0) {
        throw new Error(
            `Bundle ${bundle.id} must contain at least one Provider.`,
        );
    }
    const browserProfiles = createBundleBrowserProfiles(bundle);
    const localProfileIds = new Set(
        (bundle.browserProfiles ?? []).map((profile) => profile.id),
    );
    const grantedPermissions = new Set(bundle.permissions);
    const stagedProviders = bundle.providers.map((definition) =>
        createProviderRegistration(
            bundle.id,
            definition,
            localProfileIds,
            grantedPermissions,
        ),
    );
    const stagedPlugins = [
        ...bundle.plugins.map((definition) =>
            createPluginRegistration(bundle.id, definition),
        ),
        ...bundle.providers.flatMap((definition) =>
            definition.plugins.map((pluginDefinition) =>
                createPluginRegistration(
                    bundle.id,
                    pluginDefinition,
                    definition.manifest.id,
                ),
            ),
        ),
    ];
    if (
        stagedPlugins.some(({ metadata }) => metadata.panels?.length) &&
        !grantedPermissions.has('plugin-view')
    ) {
        throw new Error(
            `Bundle ${bundle.id} requires Bundle permission plugin-view.`,
        );
    }

    const stagedIds = new Set<string>();
    for (const registration of stagedProviders) {
        const id = registration.metadata.id;
        if (registry.sites.has(id) || stagedIds.has(id)) {
            throw new Error(`Provider id ${id} is already registered.`);
        }
        stagedIds.add(id);
    }
    const stagedPluginIds = new Set<string>();
    for (const registration of stagedPlugins) {
        const id = registration.metadata.id;
        if (registry.plugins.has(id) || stagedPluginIds.has(id)) {
            throw new Error(`Plugin id ${id} is already registered.`);
        }
        stagedPluginIds.add(id);
    }
    const composedProviders = [
        ...registry.sites.values(),
        ...stagedProviders,
    ].map((registration) => ({
        ...registration,
        metadata: withPluginSettings(registration.metadata, [
            ...registry.plugins.values(),
            ...stagedPlugins,
        ]),
    }));
    for (const registration of composedProviders)
        validateProviderDescriptors(registration.metadata);
    const actionShortcutIds = new Set(
        [...registry.sites.values()].flatMap(({ metadata }) =>
            (metadata.shortcut?.actions ?? []).map(({ id }) => id),
        ),
    );
    for (const registration of stagedProviders) {
        for (const shortcut of registration.metadata.shortcut?.actions ?? []) {
            if (actionShortcutIds.has(shortcut.id)) {
                throw new Error(
                    `Provider action shortcut id ${shortcut.id} is already registered.`,
                );
            }
            actionShortcutIds.add(shortcut.id);
        }
    }
    for (const profile of browserProfiles) {
        if (registry.browserProfiles.has(profile.id)) {
            throw new Error(
                `Browser profile ${profile.id} is already registered.`,
            );
        }
    }

    return {
        /** All effective Provider definitions. */
        composedProviders,
        /** Incoming Providers. */
        providers: stagedProviders,
        /** Incoming Plugins. */
        plugins: stagedPlugins,
        /** Bundle-owned definitions and counts. */
        bundle: {
            /** Validated Bundle profiles. */
            browserProfiles,
            /** Source Bundle definition. */
            definition: bundle,
            /** Number of newly registered Providers. */
            providerCount: stagedProviders.length,
            /** Number of newly registered Plugins. */
            pluginCount: stagedPlugins.length,
        },
    };
}

/** Resolves and validates one Provider's manifest and localized descriptors. */
function createProviderRegistration(
    bundleId: string,
    definition: ProviderDefinition,
    localProfileIds: ReadonlySet<string>,
    grantedPermissions: ReadonlySet<string>,
): RegisteredProvider {
    const { manifest, provider: constructor } = definition;
    const metadata = getProviderMetadata(constructor);
    if (!metadata) {
        throw new Error(
            `Bundle ${bundleId} exported a Provider without @provider metadata.`,
        );
    }
    if (manifest.apiVersion !== 1 || manifest.schemaVersion !== 1) {
        throw new Error(
            `Provider ${manifest.id} uses an unsupported manifest or API version.`,
        );
    }
    for (const permission of manifest.permissions) {
        if (!grantedPermissions.has(permission)) {
            throw new Error(
                `Provider ${manifest.id} requires Bundle permission ${permission}.`,
            );
        }
    }
    const descriptors = manifest.descriptors;
    const unresolvedMetadata = {
        ...metadata,
        ...descriptors,
        externalApps: descriptors.externalApps,
        fileDrop: descriptors.fileDrop,
        webExtension: descriptors.webExtension,
        id: manifest.id,
        title: manifest.name,
        description: manifest.description,
        menu: {
            ...metadata.menu,
            ...descriptors.menu,
        },
        pictureInPicture:
            metadata.pictureInPicture || descriptors.pictureInPicture
                ? {
                      ...metadata.pictureInPicture,
                      ...descriptors.pictureInPicture,
                  }
                : undefined,
        permissions: manifest.permissions,
    };
    const effectiveMetadata = resolveProviderLocaleDescriptors(
        unresolvedMetadata,
        definition.localization,
        manifest.id,
    );
    if (
        effectiveMetadata.settings?.categories.some((category) =>
            category.id.startsWith('plugin.'),
        )
    ) {
        throw new Error(
            `Provider ${manifest.id} uses the reserved plugin. settings category namespace.`,
        );
    }
    const defaultProfile = effectiveMetadata.isolation?.defaultBrowserProfile;
    if (defaultProfile && !localProfileIds.has(defaultProfile)) {
        throw new Error(
            `Provider ${manifest.id} references unknown browser profile ${defaultProfile}.`,
        );
    }

    return {
        /** The bundle ID value. */
        bundleId,
        /** The function Object() { [native code] } value. */
        constructor,
        /** The metadata value. */
        metadata: effectiveMetadata,
    };
}
