import type { DevelopmentConnection } from '../Functional/ExternalApps/DevelopmentConnection';
import type {
    ExternalAppInfo,
    ExternalAppRequest,
    ExternalAppResult,
    ExternalApps,
} from '@kawaikara/site-api';
import type {
    ExternalAppAdapter,
    ExternalAppResource,
} from '../Functional/ExternalApps/ExternalAppAdapter';
import { createExternalAppHost } from '../Functional/ExternalApps/ExternalAppHost';
import {
    ExternalAppPermissions,
    validateExternalAppDescriptor,
} from '../Functional/ExternalApps/ExternalAppPermissions';

/** Coordinates adapter registration and action dispatch; application functions belong to adapters. */
export class ExternalAppManager implements ExternalApps {
    /** Candidates are not registered or authorized until consent completes. */
    private readonly adapters = new Map<string, ExternalAppAdapter>();

    /**
     * @param adapters - App-supplied integrations offered by trusted application composition.
     * @param permissions - Registration/approval owner; no adapter receives this authority.
     * @throws Invalid or duplicate adapter identities/declarations.
     */
    constructor(
        adapters: readonly ExternalAppAdapter[],
        readonly permissions: ExternalAppPermissions,
        /** The development connection value. */
        readonly developmentConnection?: DevelopmentConnection,
    ) {
        for (const adapter of adapters) this.offer(adapter);
    }
    /**
     * Offers an app-owned adapter without granting its requested permissions.
     * @param adapter - Trusted transport implementation and app-owned declaration.
     * @remarks Remote declarations must be bound to an authenticated transport before calling this API.
     */
    offer(adapter: ExternalAppAdapter): void {
        const descriptor = validateExternalAppDescriptor(adapter.descriptor);
        if (this.adapters.has(descriptor.id))
            throw new Error('External application identity must be unique.');
        this.adapters.set(descriptor.id, {
            descriptor,
            discover: () => adapter.discover(),
            execute: (request, host) => adapter.execute(request, host),
        });
    }
    /** Returns detached data declarations for trusted registration settings. */
    descriptors() {
        return [...this.adapters.values()].map((adapter) =>
            structuredClone(adapter.descriptor),
        );
    }

    /** Returns live installation metadata; discovery alone never finalizes registration. */
    async find(
        appId: string,
        providerId?: string,
    ): Promise<ExternalAppInfo | undefined> {
        const adapter = this.adapters.get(appId);
        const installed = await adapter?.discover();
        if (!adapter || !installed) return undefined;
        const registration = await this.permissions.get(adapter.descriptor);
        return {
            /** Stable adapter, action or permission identity within this declaration. */
            id: appId,
            /** App-supplied display name, rendered as text in settings. */
            name: adapter.descriptor.name,
            /** Installed application version when exposed by native discovery. */
            version: installed.version,
            /** True only when this exact descriptor has an approved final registration. */
            registered: !!registration,
            /** App-owned functions, each enabled only by its required grants. */
            actions: adapter.descriptor.actions.map((action) => ({
                ...action,
                permissions: [...action.permissions],
                enabled:
                    !!registration &&
                    (!providerId ||
                        registration.providers?.find(
                            (item) => item.providerId === providerId,
                        )?.enabled === true) &&
                    action.permissions.every((id) =>
                        this.permissions.allows(
                            adapter.descriptor,
                            id,
                            providerId,
                        ),
                    ),
            })),
        };
    }
    /** Requests permissions before final registration, even when the user approves an empty subset. */
    async register(
        appId: string,
        provider?: import('../../Common/ExternalApps').ExternalAppProvider,
    ): Promise<boolean> {
        const epoch = this.permissions.epoch(appId);
        const adapter = this.adapters.get(appId);
        if (
            !adapter ||
            !(await adapter.discover()) ||
            this.permissions.epoch(appId) !== epoch
        )
            return false;
        return !!(await this.permissions.register(
            adapter.descriptor,
            provider,
        ));
    }
    /**
     * Calls an adapter-owned function after registration and its required grant checks.
     * @param appId - Explicitly selected external application.
     * @param request - App-owned action and parameters; no media schema is assumed.
     * @param resource - Trusted Main invocation resource, unavailable to public Provider callers.
     * @returns Handoff result or an ordinary unavailable/unsupported/permission failure.
     * @throws Adapter validation, installation discovery and transport failures.
     */
    async request(
        appId: string,
        request: ExternalAppRequest,
        resource?: ExternalAppResource,
    ): Promise<ExternalAppResult> {
        const adapter = this.adapters.get(appId);
        if (!adapter || !(await adapter.discover()))
            return {
                /** Whether the adapter accepted this function invocation. */
                accepted: false,
                /** Machine-readable reason the invocation was rejected. */
                code: 'unavailable',
                /** Whether user action or restoring application availability may allow retry. */
                recoverable: true,
            };
        const action = adapter.descriptor.actions.find(
            (entry) => entry.id === request.action,
        );
        if (!action)
            return {
                /** Whether the adapter accepted this function invocation. */
                accepted: false,
                /** Machine-readable reason the invocation was rejected. */
                code: 'unsupported-action',
                /** Whether user action or restoring application availability may allow retry. */
                recoverable: false,
            };
        const registration = await this.permissions.register(
            adapter.descriptor,
            resource?.provider,
        );
        if (
            !registration ||
            (resource?.provider &&
                !registration.providers?.find(
                    (item) => item.providerId === resource.provider!.id,
                )?.enabled) ||
            action.permissions.some(
                (id) =>
                    !this.permissions.allows(
                        adapter.descriptor,
                        id,
                        resource?.provider?.id,
                    ),
            )
        )
            return {
                /** Whether the adapter accepted this function invocation. */
                accepted: false,
                /** Machine-readable reason the invocation was rejected. */
                code: 'permission-denied',
                /** Whether user action or restoring application availability may allow retry. */
                recoverable: true,
            };
        const epoch = this.permissions.epoch(appId);
        if (!(await adapter.discover()))
            return {
                /** Whether the adapter accepted this function invocation. */
                accepted: false,
                /** Machine-readable reason the invocation was rejected. */
                code: 'unavailable',
                /** Whether user action or restoring application availability may allow retry. */
                recoverable: true,
            };
        const current = await this.permissions.get(adapter.descriptor);
        if (
            this.permissions.epoch(appId) !== epoch ||
            !current ||
            (resource?.provider &&
                !current.providers?.find(
                    (item) => item.providerId === resource.provider!.id,
                )?.enabled) ||
            action.permissions.some(
                (id) =>
                    !this.permissions.allows(
                        adapter.descriptor,
                        id,
                        resource?.provider?.id,
                    ),
            )
        )
            return {
                /** Whether the adapter accepted this function invocation. */
                accepted: false,
                /** Machine-readable reason the invocation was rejected. */
                code: 'permission-denied',
                /** Whether user action or restoring application availability may allow retry. */
                recoverable: true,
            };
        const host = createExternalAppHost(
            adapter.descriptor,
            this.permissions,
            resource,
        );
        if (action.permissions.some((id) => !host.hasPermission(id)))
            return {
                /** Whether the adapter accepted this function invocation. */
                accepted: false,
                /** Machine-readable reason the invocation was rejected. */
                code: 'permission-denied',
                /** Whether user action or restoring application availability may allow retry. */
                recoverable: true,
            };
        return adapter.execute(request, host);
    }
    /** Gives a Provider only find/request bound to its validated source and cookie profile. */
    forResource(resource: ExternalAppResource): ExternalApps {
        return {
            /** Reads public installation and registration metadata without granting access. */
            find: (id) => this.find(id, resource.provider?.id),
            /** Dispatches through the same registry with the captured trusted Provider resource. */
            request: (
                id,
                /** Dispatches through the same registry with the captured trusted Provider resource. */
                request,
            ) => this.request(id, request, resource),
        };
    }
}
