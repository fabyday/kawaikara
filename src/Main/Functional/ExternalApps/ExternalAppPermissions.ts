import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { ExternalAppDescriptor } from '@kawaikara/site-api';
import type {
    ExternalAppApproval,
    ExternalAppProvider,
    ExternalAppProviderGrant,
    ExternalAppRegistration,
    ExternalAppSettingsState,
} from '../../../Common/ExternalApps';

/**
 * Validates and snapshots app declarations before displaying or persisting their authority.
 * @param value - App-owned data descriptor; executable adapter code is not loaded here.
 * @returns A detached declaration with unique bounded identities and exact HTTPS scopes.
 * @throws Unsupported schema/host operations, wildcard origins and undeclared action requirements.
 */
export function validateExternalAppDescriptor(
    value: ExternalAppDescriptor,
): ExternalAppDescriptor {
    const descriptor = structuredClone(value);
    /** Accepts bounded stable identifiers, never executable paths or arbitrary code. */
    const identifier = (id: unknown) =>
        typeof id === 'string' &&
        /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(id);
    if (
        descriptor.schemaVersion !== 1 ||
        !identifier(descriptor.id) ||
        typeof descriptor.name !== 'string' ||
        !descriptor.name ||
        descriptor.name.length > 200 ||
        !identifier(descriptor.revision) ||
        !Array.isArray(descriptor.permissions) ||
        !Array.isArray(descriptor.actions) ||
        descriptor.permissions.length > 64 ||
        descriptor.actions.length > 128
    )
        throw new Error('Invalid external app descriptor.');
    const permissions = new Set<string>();
    for (const permission of descriptor.permissions) {
        if (
            !identifier(permission.id) ||
            permissions.has(permission.id) ||
            !['resource.url', 'cookies.read'].includes(permission.kind) ||
            !Array.isArray(permission.origins) ||
            !permission.origins.length ||
            permission.origins.length > 64
        )
            throw new Error('Invalid external app permission.');
        for (const origin of permission.origins) {
            const url = new URL(origin);
            if (
                url.protocol !== 'https:' ||
                url.hostname.includes('*') ||
                url.origin !== origin ||
                url.username ||
                url.password ||
                url.port
            )
                throw new Error(
                    'External app permissions require exact HTTPS origins.',
                );
        }
        permissions.add(permission.id);
    }
    const actions = new Set<string>();
    for (const action of descriptor.actions) {
        if (
            !identifier(action.id) ||
            actions.has(action.id) ||
            !Array.isArray(action.permissions) ||
            action.permissions.some((id: string) => !permissions.has(id))
        )
            throw new Error('Invalid external app action.');
        actions.add(action.id);
    }
    return descriptor;
}

/** Binds grants to the complete declaration, including optional permissions and action requirements. */
export function externalAppFingerprint(
    descriptor: ExternalAppDescriptor,
): string {
    return createHash('sha256')
        .update(JSON.stringify(descriptor))
        .digest('hex');
}

/** Internal prompt result; undefined is cancellation, while an empty grant list is explicit approval. */
interface ExternalAppDecision {
    /** Approved declaration-local permission identities. */
    readonly grants: string[];
    /** Whether a per-use cookie approval should persist for this Provider. */
    readonly remember: boolean;
    /** Explicit choices from the current approval UI. */
    readonly choices?: import('../../../Common/ExternalApps').ExternalAppPermissionChoices;
}

/** Owns serialized consent and durable grants. Closing/canceling a prompt never registers an app. */
export class ExternalAppPermissions {
    /** Invocation grants are attached only to the exact result, never global registration state. */
    private readonly invocationGrants = new WeakMap<
        ExternalAppRegistration,
        readonly string[]
    >();
    /** Consumes one registration result's temporary authority; callers bind it to their resource. */
    takeInvocationGrants(
        registration: ExternalAppRegistration,
    ): readonly string[] {
        const grants = this.invocationGrants.get(registration) ?? [];
        this.invocationGrants.delete(registration);
        return grants;
    }
    /** Revocation generations prevent reapproval from resurrecting old host handles. */
    private readonly epochs = new Map<string, number>();
    /** Current revocation generation, invalidating previously issued host facades. */
    epoch(appId: string): number {
        return this.epochs.get(appId) ?? 0;
    }
    /** Combines app revocation and Provider-policy generations without revoking other Providers. */
    resourceEpoch(appId: string, providerId?: string): string {
        return `${this.epoch(appId)}:${providerId ? this.epoch(`${appId}\0${providerId}`) : 0}`;
    }
    /** Finalized grants indexed by app identity; candidates are excluded. */
    private readonly registrations = new Map<string, ExternalAppRegistration>();
    /** Initial persisted-state read; failures prevent registration rather than granting defaults. */
    private readonly ready: Promise<void>;
    /** Serializes registration prompts so the UI reviews one app at a time. */
    private queue: Promise<unknown> = Promise.resolve();
    /** Serializes atomic state-file replacements without persisting any resource values. */
    private writes: Promise<void> = Promise.resolve();
    /** Current single-use approval request and its completion callback. */
    private pending?: {
        /** Pending declaration and opaque decision ID, with no secret resource values. */
        approval: ExternalAppApproval;
        /** Completes the prompt with selected grant IDs; undefined means cancellation. */
        resolve: (decision: ExternalAppDecision | undefined) => void;
    };

    /**
     * @param statePath - Private local JSON store; omit for ephemeral tests.
     * @param showApproval - Focuses the trusted settings UI after a prompt has been queued.
     */
    constructor(
        private readonly statePath?: string,
        private readonly showApproval: () => void = () => {},
    ) {
        this.ready = this.load();
    }
    /** Loads only structural grant records; malformed data never grants access. */
    private async load(): Promise<void> {
        if (!this.statePath) return;
        try {
            const value: unknown = JSON.parse(
                await readFile(this.statePath, 'utf8'),
            );
            if (!Array.isArray(value)) return;
            for (const record of value) {
                if (
                    record &&
                    typeof record.appId === 'string' &&
                    typeof record.name === 'string' &&
                    typeof record.fingerprint === 'string' &&
                    Array.isArray(record.grants) &&
                    record.grants.every((id: unknown) => typeof id === 'string')
                )
                    this.registrations.set(record.appId, {
                        ...record,
                        providers: Array.isArray(record.providers)
                            ? record.providers.filter(
                                  (grant: ExternalAppProviderGrant) =>
                                      grant &&
                                      typeof grant.providerId === 'string' &&
                                      typeof grant.enabled === 'boolean' &&
                                      Array.isArray(grant.grants) &&
                                      grant.grants.every(
                                          (id) => typeof id === 'string',
                                      ) &&
                                      grant.cookies &&
                                      typeof grant.cookies === 'object' &&
                                      !Array.isArray(grant.cookies) &&
                                      Object.values(grant.cookies).every(
                                          (mode) =>
                                              ['ask', 'allow', 'deny'].includes(
                                                  mode,
                                              ),
                                      ),
                              )
                            : [],
                    });
            }
        } catch (error) {
            if (
                (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
                !(error instanceof SyntaxError)
            )
                throw error;
        }
    }
    /** Persists a captured snapshot atomically and serializes mutations across apps. */
    private save(): Promise<void> {
        if (!this.statePath) return Promise.resolve();
        const file = this.statePath;
        const contents = JSON.stringify([...this.registrations.values()]);
        const write = this.writes
            .catch(() => {})
            .then(async () => {
                await mkdir(path.dirname(file), { recursive: true });
                const temporary = `${file}.${randomUUID()}.tmp`;
                await writeFile(temporary, contents, { mode: 0o600 });
                await rename(temporary, file);
            });
        this.writes = write;
        return write;
    }
    /** Returns only grants matching this exact declaration; changed adapters are unregistered. */
    async get(
        descriptor: ExternalAppDescriptor,
    ): Promise<ExternalAppRegistration | undefined> {
        await this.ready;
        const record = this.registrations.get(descriptor.id);
        return record?.fingerprint === externalAppFingerprint(descriptor)
            ? structuredClone(record)
            : undefined;
    }
    /** Checks whether an invocation-only grant still belongs to the live declaration and Provider policy. */
    allowsOnce(
        descriptor: ExternalAppDescriptor,
        permissionId: string,
        providerId?: string,
    ): boolean {
        const record = this.registrations.get(descriptor.id);
        if (record?.fingerprint !== externalAppFingerprint(descriptor))
            return false;
        if (!providerId)
            return record.askPermissions?.includes(permissionId) === true;
        const grant = record.providers?.find(
            (item) => item.providerId === providerId,
        );
        return (
            grant?.enabled === true &&
            grant.askPermissions?.includes(permissionId) === true
        );
    }
    /** Checks live, declaration-bound authority for one Provider, without reading any data. */
    allows(
        descriptor: ExternalAppDescriptor,
        permissionId: string,
        providerId?: string,
    ): boolean {
        const record = this.registrations.get(descriptor.id);
        if (record?.fingerprint !== externalAppFingerprint(descriptor))
            return false;
        const permission = descriptor.permissions.find(
            (item) => item.id === permissionId,
        );
        if (!permission) return false;
        if (!providerId)
            return (
                permission.kind === 'resource.url' &&
                record.grants.includes(permissionId)
            );
        const grant = record.providers?.find(
            (item) => item.providerId === providerId,
        );
        if (!grant?.enabled) return false;
        return permission.kind === 'cookies.read'
            ? ['ask', 'allow'].includes(grant.cookies[permissionId])
            : grant.grants.includes(permissionId);
    }

    /** Shows one bounded consent prompt; callers must hold the serialized decision queue. */
    private prompt(
        approval: ExternalAppApproval,
    ): Promise<ExternalAppDecision | undefined> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => this.decide(approval.id, undefined),
                120_000,
            );
            timer.unref();
            this.pending = {
                approval,
                resolve: (value) => {
                    clearTimeout(timer);
                    this.pending = undefined;
                    resolve(value);
                },
            };
            try {
                this.showApproval();
            } catch (error) {
                clearTimeout(timer);
                this.pending = undefined;
                reject(error);
            }
        });
    }

    /**
     * Authorizes one cookie read, asking again unless this Provider has a remembered decision.
     * @param descriptor - Exact registered app declaration.
     * @param provider - Main-selected Provider identity for the originating resource.
     * @param permissionId - Declared cookie permission; URL permissions cannot use this API.
     * @returns False on denial, cancellation, expiration or any intervening revocation.
     * @remarks Contains no cookie values. The host must recheck the resource after this await.
     */
    requestCookies(
        descriptor: ExternalAppDescriptor,
        provider: ExternalAppProvider,
        permissionId: string,
    ): Promise<boolean> {
        const epoch = this.resourceEpoch(descriptor.id, provider.id);
        const run = this.queue
            .catch(() => {})
            .then(async () => {
                await this.ready;
                if (
                    this.resourceEpoch(descriptor.id, provider.id) !== epoch ||
                    !this.allows(descriptor, permissionId, provider.id) ||
                    descriptor.permissions.find(
                        (item) => item.id === permissionId,
                    )?.kind !== 'cookies.read'
                )
                    return false;
                const record = this.registrations.get(descriptor.id)!;
                const grant = record.providers!.find(
                    (item) => item.providerId === provider.id,
                )!;
                if (grant.cookies[permissionId] === 'allow') return true;
                const decision = await this.prompt({
                    id: randomUUID(),
                    descriptor: structuredClone(descriptor),
                    provider,
                    cookiePermission: permissionId,
                });
                if (
                    this.resourceEpoch(descriptor.id, provider.id) !== epoch ||
                    !decision?.grants.includes(permissionId) ||
                    !this.allows(descriptor, permissionId, provider.id)
                )
                    return false;
                if (decision.remember) {
                    const latest = this.registrations.get(descriptor.id)!;
                    const updated = {
                        ...grant,
                        cookies: {
                            ...grant.cookies,
                            [permissionId]: 'allow' as const,
                        },
                    };
                    this.registrations.set(descriptor.id, {
                        ...latest,
                        providers: latest.providers!.map((item) =>
                            item.providerId === provider.id ? updated : item,
                        ),
                    });
                    try {
                        await this.save();
                    } catch (error) {
                        this.epochs.set(
                            descriptor.id,
                            this.epoch(descriptor.id) + 1,
                        );
                        this.registrations.delete(descriptor.id);
                        throw error;
                    }
                }
                return this.resourceEpoch(descriptor.id, provider.id) === epoch;
            });
        this.queue = run;
        return run;
    }

    /**
     * Replaces one Provider's policy from trusted settings and invalidates outstanding resource handles.
     * @param descriptor - Current adapter declaration, used to validate permission identities and kinds.
     * @param grant - Complete replacement policy for one currently declared Provider/app pair.
     * @throws Invalid policy, unregistered app, or a persistence failure. Never grants new host primitives.
     */
    async configureProvider(
        descriptor: ExternalAppDescriptor,
        grant: ExternalAppProviderGrant,
    ): Promise<void> {
        const epoch = this.resourceEpoch(descriptor.id, grant?.providerId);
        const record = await this.get(descriptor);
        if (
            epoch !== this.resourceEpoch(descriptor.id, grant?.providerId) ||
            !record ||
            !grant ||
            typeof grant.providerId !== 'string' ||
            typeof grant.enabled !== 'boolean' ||
            !Array.isArray(grant.grants) ||
            !grant.cookies ||
            typeof grant.cookies !== 'object' ||
            Array.isArray(grant.cookies) ||
            grant.grants.some(
                (id) =>
                    !descriptor.permissions.some(
                        (item) =>
                            item.id === id && item.kind === 'resource.url',
                    ),
            ) ||
            Object.entries(grant.cookies).some(
                ([id, mode]) =>
                    !['ask', 'allow', 'deny'].includes(mode) ||
                    !descriptor.permissions.some(
                        (item) =>
                            item.id === id && item.kind === 'cookies.read',
                    ),
            )
        )
            throw new Error('Invalid external app Provider policy.');
        const key = `${descriptor.id}\0${grant.providerId}`;
        this.epochs.set(key, this.epoch(key) + 1);
        if (
            this.pending?.approval.descriptor.id === descriptor.id &&
            this.pending.approval.provider?.id === grant.providerId
        )
            this.decide(this.pending.approval.id, undefined);
        const latest = this.registrations.get(descriptor.id)!;
        this.registrations.set(descriptor.id, {
            ...latest,
            providers: [
                ...(latest.providers ?? []).filter(
                    (item) => item.providerId !== grant.providerId,
                ),
                structuredClone(grant),
            ],
        });
        try {
            await this.save();
        } catch (error) {
            this.epochs.set(descriptor.id, this.epoch(descriptor.id) + 1);
            this.registrations.delete(descriptor.id);
            throw error;
        }
    }
    /**
     * Requests individual grants and finalizes registration only after explicit approval.
     * @param descriptor - Validated immutable app declaration.
     * @param provider - Trusted caller identity; each Provider receives separate initial consent.
     * @returns Registration (including an empty grant set), or undefined on cancel/timeout.
     * @remarks Concurrent requests for an unchanged app share the first persisted decision.
     */
    register(
        descriptor: ExternalAppDescriptor,
        provider?: ExternalAppProvider,
    ): Promise<ExternalAppRegistration | undefined> {
        const epoch = this.resourceEpoch(descriptor.id, provider?.id);
        const run = this.queue
            .catch(() => {})
            .then(async () => {
                if (this.resourceEpoch(descriptor.id, provider?.id) !== epoch)
                    return undefined;
                const existing = await this.get(descriptor);
                if (
                    existing &&
                    (!provider
                        ? !existing.askPermissions?.length
                        : existing.providers?.some(
                              (item) =>
                                  item.providerId === provider.id &&
                                  !item.askPermissions?.length,
                          ))
                )
                    return existing;
                const prior = existing?.providers?.find(
                    (item) => item.providerId === provider?.id,
                );
                const initialChoices = Object.fromEntries(
                    descriptor.permissions.map((item) => [
                        item.id,
                        (
                            item.kind === 'resource.url'
                                ? (provider
                                      ? prior?.grants
                                      : existing?.grants
                                  )?.includes(item.id)
                                : prior?.cookies[item.id] === 'allow'
                        )
                            ? ('always' as const)
                            : ('deny' as const),
                    ]),
                );
                const decision = await this.prompt({
                    id: randomUUID(),
                    descriptor: structuredClone(descriptor),
                    provider,
                    initialChoices,
                });
                if (
                    !decision ||
                    this.resourceEpoch(descriptor.id, provider?.id) !== epoch
                )
                    return undefined;
                const grants = decision.grants.filter(
                    (id) => decision.choices?.[id] !== 'once',
                );
                const once = decision.grants.filter(
                    (id) => decision.choices?.[id] === 'once',
                );
                const providerGrant: ExternalAppProviderGrant | undefined =
                    provider
                        ? {
                              providerId: provider.id,
                              enabled: true,
                              askPermissions: once.filter(
                                  (id) =>
                                      descriptor.permissions.find(
                                          (item) => item.id === id,
                                      )?.kind === 'resource.url',
                              ),
                              grants: grants.filter(
                                  (id) =>
                                      descriptor.permissions.find(
                                          (item) => item.id === id,
                                      )?.kind === 'resource.url',
                              ),
                              cookies: Object.fromEntries(
                                  descriptor.permissions
                                      .filter(
                                          (item) =>
                                              item.kind === 'cookies.read',
                                      )
                                      .map((item) => [
                                          item.id,
                                          decision.choices?.[item.id] ===
                                          'always'
                                              ? 'allow'
                                              : decision.grants.includes(
                                                      item.id,
                                                  )
                                                ? 'ask'
                                                : 'deny',
                                      ]),
                              ),
                          }
                        : undefined;
                const saved = this.registrations.get(descriptor.id);
                const latest =
                    saved?.fingerprint === externalAppFingerprint(descriptor)
                        ? saved
                        : undefined;
                const record: ExternalAppRegistration = {
                    appId: descriptor.id,
                    askPermissions: provider ? latest?.askPermissions : once,
                    name: descriptor.name,
                    fingerprint: externalAppFingerprint(descriptor),
                    grants:
                        (provider ? latest?.grants : undefined) ??
                        grants.filter(
                            (id) =>
                                descriptor.permissions.find(
                                    (item) => item.id === id,
                                )?.kind === 'resource.url',
                        ),
                    providers: providerGrant
                        ? [
                              ...(latest?.providers ?? []).filter(
                                  (item) => item.providerId !== provider!.id,
                              ),
                              providerGrant,
                          ]
                        : latest?.providers,
                };
                this.registrations.set(descriptor.id, record);
                try {
                    await this.save();
                } catch (error) {
                    this.epochs.set(
                        descriptor.id,
                        this.epoch(descriptor.id) + 1,
                    );
                    this.registrations.delete(descriptor.id);
                    throw error;
                }
                if (this.resourceEpoch(descriptor.id, provider?.id) !== epoch)
                    return undefined;
                if (prior || (!provider && existing)) {
                    const key = provider
                        ? `${descriptor.id}\0${provider.id}`
                        : descriptor.id;
                    this.epochs.set(key, this.epoch(key) + 1);
                }
                const result = structuredClone(record);
                this.invocationGrants.set(result, once);
                return result;
            });
        this.queue = run;
        return run;
    }
    /** Validates per-permission choices before resolving a registration prompt. */
    decideChoices(id: string, value: unknown): void {
        if (
            !value ||
            typeof value !== 'object' ||
            Array.isArray(value) ||
            Object.values(value).some(
                (choice) => !['deny', 'once', 'always'].includes(choice),
            )
        )
            throw new Error('Invalid external app permission choices.');
        const choices =
            value as import('../../../Common/ExternalApps').ExternalAppPermissionChoices;
        if (
            !this.pending ||
            this.pending.approval.id !== id ||
            this.pending.approval.cookiePermission ||
            Object.keys(choices).some(
                (key) =>
                    !this.pending!.approval.descriptor.permissions.some(
                        (p) => p.id === key,
                    ),
            )
        )
            throw new Error('Invalid external app approval.');
        this.pending.resolve({
            grants: Object.keys(choices).filter(
                (key) => choices[key] !== 'deny',
            ),
            remember: false,
            choices: { ...choices },
        });
    }
    /**
     * Resolves the currently displayed single-use registration prompt.
     * @param id - Opaque prompt identity supplied only to the trusted settings UI.
     * @param grants - Approved permission IDs; [] registers without grants, undefined cancels.
     * @param remember - On a cookie prompt, persist approval for this Provider instead of one read.
     * @throws Expired identities or undeclared permission IDs without changing pending state.
     */
    decide(
        id: string,
        grants: readonly string[] | undefined,
        remember = false,
    ): void {
        if (!this.pending || this.pending.approval.id !== id)
            throw new Error('External app approval expired.');
        if (
            grants &&
            (!Array.isArray(grants) ||
                grants.some(
                    (grant) =>
                        !this.pending!.approval.descriptor.permissions.some(
                            (permission) => permission.id === grant,
                        ),
                ))
        )
            throw new Error('Undeclared external app permission.');
        if (
            this.pending.approval.cookiePermission &&
            grants?.some(
                (grant) => grant !== this.pending!.approval.cookiePermission,
            )
        )
            throw new Error('Invalid cookie permission decision.');
        this.pending.resolve(
            grants ? { grants: [...new Set(grants)], remember } : undefined,
        );
    }
    /**
     * Revokes saved/pending authority and all previously issued host handles.
     * @param appId - Registered product identity; unknown identities are harmless.
     * @returns Completion of the atomic removal from the local grant store.
     * @throws Storage errors; in-memory authority remains revoked even if persistence fails.
     */
    async revoke(appId: string): Promise<void> {
        await this.ready;
        this.epochs.set(appId, this.epoch(appId) + 1);
        if (this.pending?.approval.descriptor.id === appId)
            this.decide(this.pending.approval.id, undefined);
        this.registrations.delete(appId);
        await this.save();
    }
    /** Returns a clone safe for the settings Renderer; never includes cookie data. */
    async status(): Promise<ExternalAppSettingsState> {
        await this.ready;
        return structuredClone({
            /** Pending declaration and opaque decision ID, with no secret resource values. */
            approval: this.pending?.approval,
            /** Finalized grants indexed by app identity; candidates are excluded. */
            registrations: [...this.registrations.values()],
        });
    }
}
