import type { ExternalAppIntegration } from '@kawaikara/site-api';
import type { ExternalAppAdapter } from './ExternalAppAdapter';
import type { DevelopmentConnection } from './DevelopmentConnection';
import type { ExternalAppCallbackServer } from './ExternalAppCallbackServer';
import { createProviderAppAdapter, validateExternalAppIntegration } from './ProviderAppAdapter';
import { externalAppFingerprint, validateExternalAppDescriptor } from './ExternalAppPermissions';

/** Validated Provider ownership inputs supplied by Bundle registration. */
export interface ProviderAppRegistration {
    /** Provider identity; not the external application's identity. */
    readonly id: string;
    /** App identities explicitly declared in the Provider manifest. */
    readonly declared: readonly string[];
    /** Protocol adapters shipped in this Provider Bundle. */
    readonly integrations: readonly ExternalAppIntegration[];
}
/** One app declaration with independently owned Provider protocol implementations. */
interface Entry {
    /** Detached declaration used to detect conflicting permission/action requirements. */
    readonly descriptor: ExternalAppIntegration['descriptor'];
    /** Custom scheme shared by all integrations for this product. */
    readonly protocol: string;
    /** Each Provider retains its own app-specific request/event functions. */
    readonly owners: Map<string, ExternalAppAdapter>;
}

/** Registers Bundle-owned adapters atomically and removes them when their owners unload. */
export class ProviderAppRegistry {
    /** Current app declarations and owning Provider adapters. */
    private entries = new Map<string, Entry>();
    /** Creates a registry without starting any callback or native discovery operations. */
    constructor(
        /** Shared lazy authenticated resource transport. */
        private readonly callbacks: ExternalAppCallbackServer,
        /** Optional isolated development connection. */
        private readonly development?: DevelopmentConnection,
    ) { }
    /** Validates a batch before publication; conflicts never partially install integrations. */
    register(providers: readonly ProviderAppRegistration[]): void {
        const staged = new Map(this.entries);
        for (const provider of providers) {
            const seen = new Set<string>();
            for (const integration of provider.integrations) {
                validateExternalAppIntegration(integration);
                const descriptor = validateExternalAppDescriptor(integration.descriptor);
                const id = descriptor.id;
                if (!provider.declared.includes(id) || seen.has(id))
                    throw new Error('Undeclared or duplicate external app integration.');
                seen.add(id);
                const previous = staged.get(id);
                if (previous && (previous.protocol !== integration.protocol ||
                    externalAppFingerprint(previous.descriptor) !== externalAppFingerprint(descriptor)))
                    throw new Error('Conflicting external app integrations.');
                const owners = new Map(previous?.owners);
                owners.set(provider.id, createProviderAppAdapter(integration, this.callbacks, this.development));
                staged.set(id, { descriptor, protocol: integration.protocol, owners });
            }
        }
        this.entries = staged;
        for (const id of staged.keys()) this.development?.allowApp(id);
    }
    /** Resolves the requesting Provider's implementation; discovery may use any identical declaration. */
    get(id: string, providerId?: string): ExternalAppAdapter | undefined {
        const owners = this.entries.get(id)?.owners;
        return providerId ? owners?.get(providerId) : owners?.values().next().value;
    }
    /** Returns detached permission/action declarations for settings. */
    descriptors() { return [...this.entries.values()].map(entry => structuredClone(entry.descriptor)); }
    /** Removes one owner and stops discovery when its last integration disappears. */
    remove(providerId: string): void {
        for (const [id, entry] of this.entries) {
            entry.owners.delete(providerId);
            if (entry.owners.size) continue;
            this.entries.delete(id);
            this.development?.removeApp(id);
        }
    }
}
