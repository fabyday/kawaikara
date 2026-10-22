import type { ExternalAppDescriptor } from '@kawaikara/site-api';
import type {
    ExternalAppHost,
    ExternalAppResource,
} from './ExternalAppAdapter';
import type { ExternalAppPermissions } from './ExternalAppPermissions';

/**
 * Builds a host facade bound to one registration generation and one Provider resource.
 * @param descriptor - Approved adapter declaration, including exact resource origins.
 * @param permissions - Live grant owner; revocation is checked on every operation.
 * @param resource - Main-selected URL/profile resource, never app-controlled parameters.
 * @param once - Explicit approval scoped to this invocation, excluded from durable grants.
 * @returns URL/cookie operations that reject absent, wrong-kind and out-of-scope grants.
 */
export function createExternalAppHost(
    descriptor: ExternalAppDescriptor,
    permissions: ExternalAppPermissions,
    resource?: ExternalAppResource,
    once: readonly string[] = [],
): ExternalAppHost {
    const cookieCredits = new Set(once);
    const epoch = permissions.resourceEpoch(
        descriptor.id,
        resource?.provider?.id,
    );
    /** Checks the live registration generation, resource ownership and exact approved origin. */
    const allowed = (id: string) => {
        const declaration = descriptor.permissions.find(
            (permission) => permission.id === id,
        );
        return (
            !!resource &&
            resource.isActive() &&
            permissions.resourceEpoch(descriptor.id, resource?.provider?.id) ===
                epoch &&
            ((once.includes(id) &&
                permissions.allowsOnce(
                    descriptor,
                    id,
                    resource?.provider?.id,
                )) ||
                permissions.allows(descriptor, id, resource?.provider?.id)) &&
            !!declaration?.origins.includes(new URL(resource.url).origin)
        );
    };
    /** Rejects a missing, revoked, wrong-kind or out-of-scope resource grant. */
    const requirePermission = (
        id: string,
        kind: 'resource.url' | 'cookies.read',
    ) => {
        if (
            !allowed(id) ||
            descriptor.permissions.find((permission) => permission.id === id)
                ?.kind !== kind
        )
            throw new Error('External app resource permission denied.');
    };
    return {
        /** Checks permission without reading or returning resource data. */
        hasPermission: allowed,
        /** Returns only this invocation URL after the live resource.url check. */
        getUrl: (id) => {
            requirePermission(id, 'resource.url');
            return resource!.url;
        },
        /** Reads this invocation profile and rechecks authority before returning secret values. */
        getCookies: async (id) => {
            requirePermission(id, 'cookies.read');
            if (
                !resource?.provider ||
                (!cookieCredits.delete(id) &&
                    !(await permissions.requestCookies(
                        descriptor,
                        resource.provider,
                        id,
                    )))
            )
                throw new Error('External app resource permission denied.');
            requirePermission(id, 'cookies.read');
            const cookies = await resource!.readCookies();
            requirePermission(id, 'cookies.read');
            return cookies;
        },
    };
}
