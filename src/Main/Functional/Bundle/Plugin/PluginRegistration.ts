import { getPluginMetadata, type PluginDefinition } from '@kawaikara/site-api';
import {
    validatePanelDescriptors,
    type RegisteredRuntimePlugin,
} from '../Provider/SiteRuntime';

/**
 * Validates Plugin metadata against its manifest and resolves its registration scope.
 *
 * @param bundleId - Owning Bundle identifier, used for ownership and diagnostics.
 * @param definition - Loaded Plugin constructor and its manifest.
 * @param scopedProviderId - Physical owner for a Provider-local Plugin; omit for Bundle-level Plugins.
 * @returns A registration record retaining the constructor and effective metadata.
 * @throws When decorator metadata is missing, identifiers or API versions disagree,
 * activation settings are invalid, scope excludes the owner, or panel descriptors are invalid.
 * @remarks Does not construct or activate the Plugin. Permission checks against the
 * Bundle and composition with Provider settings belong to Bundle registration staging.
 */
export function createPluginRegistration(
    bundleId: string,
    definition: PluginDefinition,
    scopedProviderId?: string,
): RegisteredRuntimePlugin {
    const { manifest, plugin: constructor } = definition;
    const metadata = getPluginMetadata(constructor);
    if (!metadata) {
        throw new Error(
            `Bundle ${bundleId} exported a Plugin without @plugin metadata.`,
        );
    }
    if (manifest.id !== metadata.id) {
        throw new Error(
            `Plugin manifest id ${manifest.id} does not match @plugin id ${metadata.id}.`,
        );
    }
    if (manifest.apiVersion !== 1 || manifest.schemaVersion !== 1) {
        throw new Error(
            `Plugin ${manifest.id} uses an unsupported manifest or API version.`,
        );
    }
    if (metadata.activation && metadata.activation.type !== 'boolean') {
        throw new Error(
            `Plugin ${manifest.id} activation must be a boolean setting.`,
        );
    }
    if (
        !scopedProviderId &&
        metadata.providerIds?.length &&
        (metadata.providerIds.length !== (manifest.providerIds?.length ?? 0) ||
            metadata.providerIds.some(
                (id) => !manifest.providerIds?.includes(id),
            ))
    ) {
        throw new Error(
            `Plugin ${manifest.id} manifest scope does not match @plugin metadata.`,
        );
    }
    if (
        scopedProviderId &&
        metadata.providerIds?.length &&
        !metadata.providerIds.includes(scopedProviderId)
    ) {
        throw new Error(
            `Provider-owned Plugin ${metadata.id} excludes its owner ${scopedProviderId}.`,
        );
    }
    const effectiveMetadata = {
        ...metadata,
        name: manifest.name,
        providerIds: scopedProviderId
            ? metadata.providerIds
            : manifest.providerIds,
    };
    validatePanelDescriptors(
        effectiveMetadata.panels ?? [],
        `Plugin ${manifest.id}`,
    );
    return {
        /** The bundle ID value. */
        bundleId,
        /** The function Object() { [native code] } value. */
        constructor,
        /** The metadata value. */
        metadata: effectiveMetadata,
        /** The scoped provider ID value. */
        scopedProviderId,
    };
}
