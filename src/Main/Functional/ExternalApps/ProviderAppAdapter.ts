import type { ExternalAppIntegration } from '@kawaikara/site-api';
import type { ExternalAppAdapter } from './ExternalAppAdapter';
import type { DevelopmentConnection } from './DevelopmentConnection';
import type { ExternalAppCallbackServer } from './ExternalAppCallbackServer';
import { findExternalApplication, launchExternalApplication, type InstalledExternalApplication } from '../../Platform/ExternalApplication';
import { validateExternalAppDescriptor } from './ExternalAppPermissions';

/** Validates the data boundary before any Provider integration is registered. */
export function validateExternalAppIntegration(integration: ExternalAppIntegration): void {
    validateExternalAppDescriptor(integration.descriptor);
    if (!/^[a-z][a-z0-9.-]{2,79}$/.test(integration.protocol) ||
        ['http', 'https', 'file', 'data', 'javascript', 'mailto', 'tel', 'ftp', 'ssh', 'smb'].includes(integration.protocol) ||
        typeof integration.createLaunchUrl !== 'function' ||
        (integration.onEvent !== undefined && typeof integration.onEvent !== 'function'))
        throw new TypeError('Invalid external application integration.');
}

/**
 * Supplies native transport to a Bundle-owned protocol adapter.
 * @param integration - Validated Provider code and its app-owned declaration.
 * @param callbacks - Shared authenticated resource/event transport.
 * @param development - Optional isolated development handoff; never falls back to native launch.
 * @returns Generic registry adapter whose actions and event semantics remain Provider-owned.
 */
export function createProviderAppAdapter(
    integration: ExternalAppIntegration,
    callbacks: ExternalAppCallbackServer,
    development?: DevelopmentConnection,
): ExternalAppAdapter {
    validateExternalAppIntegration(integration);
    const descriptor = validateExternalAppDescriptor(integration.descriptor);
    const protocol = integration.protocol;
    const createLaunchUrl = integration.createLaunchUrl.bind(integration);
    const onEvent = integration.onEvent?.bind(integration);
    /** Resolves only the connection mode selected for this host. */
    const discover = async (): Promise<InstalledExternalApplication | undefined> => development
        ? (development.online(descriptor.id) ? {} : undefined)
        : findExternalApplication(descriptor.id, protocol);
    return {
        /** The descriptor value. */
        descriptor,
        /** The discover value. */
        discover,
        /** Checks grants immediately before dispatch and while a development handoff is pending. */
        async execute(request, host) {
            const installed = await discover();
            if (!installed) return {
                /** The accepted value. */
                accepted: false,
                /** The code value. */
                code: 'unavailable',
                /** The recoverable value. */
                recoverable: true
            };
            const action = descriptor.actions.find(item => item.id === request.action);
            /** Performs the active operation. */
            const active = () => host.isActive() && !!action && action.permissions.every(id => host.hasPermission(id));
            if (!active()) return {
                /** The accepted value. */
                accepted: false,
                /** The code value. */
                code: 'permission-denied',
                /** The recoverable value. */
                recoverable: true
            };
            const callback = await callbacks.createRequest({
                host,
                onEvent: onEvent ? (value, id) => {
                    if (!host.isActive()) throw new Error('External app invocation is no longer active.');
                    return onEvent(value, id);
                } : undefined,
            });
            try {
                const value = createLaunchUrl(request, {
                    callback,
                    getUrl: id => host.getUrl(id),
                    hasPermission: id => host.hasPermission(id),
                });
                if (typeof value !== 'string' || value.length > 32768) throw new TypeError('Invalid external app URL.');
                const url = new URL(value);
                if (url.protocol !== `${protocol}:` || url.username || url.password)
                    throw new TypeError('External app protocol mismatch.');
                if (!active()) throw new Error('External app permission was revoked.');
                if (development) await development.launch(descriptor.id, url.toString(), active);
                else await launchExternalApplication(url.toString(), installed.path);
                return {
                    /** The accepted value. */
                    accepted: true,
                    /** The request ID value. */
                    requestId: callback.requestId
                };
            } catch (error) {
                callbacks.cancel(callback.requestId);
                throw error;
            }
        },
    };
}
