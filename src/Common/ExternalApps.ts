import type { ExternalAppDescriptor } from '@kawaikara/site-api';

/** Explicit per-permission approval; once is scoped to the invocation and never a durable grant. */
export type ExternalAppPermissionChoices = Readonly<
    Record<string, 'deny' | 'once' | 'always'>
>;

/** Remembered policy for one Provider's cookie access. */
export type ExternalAppCookiePolicy = 'ask' | 'allow' | 'deny';

/** Main-owned Provider identity, never supplied by the external application. */
export interface ExternalAppProvider {
    /** Stable registered Provider identity. */
    readonly id: string;
    /** Localized Provider display name. */
    readonly name: string;
}
/** Durable authorization for one Provider/app pair. */
export interface ExternalAppProviderGrant {
    /** Provider identity. */
    readonly providerId: string;
    /** Whether this Provider may invoke the app. */
    readonly enabled: boolean;
    /** Independently approved URL permissions. */
    readonly grants: readonly string[];
    /** Permissions requiring fresh approval on the next invocation. */
    readonly askPermissions?: readonly string[];
    /** Cookie decisions keyed by declared permission identity. */
    readonly cookies: Readonly<Record<string, ExternalAppCookiePolicy>>;
}
/** Settings-only registration prompt; no cookies or native paths are exposed. */
export interface ExternalAppApproval {
    /** Single-use decision identity. */
    readonly id: string;
    /** App-supplied declarations rendered as text. */
    readonly descriptor: ExternalAppDescriptor;
    /** Provider whose resource is being authorized. */
    readonly provider?: ExternalAppProvider;
    /** Remembered durable decisions preselected when another permission needs renewed consent. */
    readonly initialChoices?: ExternalAppPermissionChoices;
    /** Present only for a per-use cookie confirmation. */
    readonly cookiePermission?: string;
}
/** Persisted registration metadata visible to application settings. */
export interface ExternalAppRegistration {
    /** App identity. */
    readonly appId: string;
    /** Registered display name. */
    readonly name: string;
    /** Exact declaration digest; a changed declaration requires approval again. */
    readonly fingerprint: string;
    /** Individually approved permission IDs; empty is a valid restricted registration. */
    readonly grants: readonly string[];
    /** Permissions requiring fresh approval on the next invocation. */
    readonly askPermissions?: readonly string[];
    /** Provider authorizations; legacy app-wide cookies never migrate to these grants. */
    readonly providers?: readonly ExternalAppProviderGrant[];
}
/** Settings snapshot of registered applications and the next approval prompt. */
export interface ExternalAppSettingsState {
    /** Validated cached PNG data URLs; no remote fetches in the Renderer. */
    readonly icons?: Readonly<Record<string, string>>;
    /** Development-only liveness; absent in installed production applications. */
    readonly connectionAutomatic?: boolean;
    /** The connection candidates value. */
    readonly connectionCandidates?: readonly {
        /** The app ID value. */
        readonly appId: string;
        /** The client ID value. */
        readonly clientId: string;
    }[];
    /** The development value. */
    readonly development?: readonly {
        /** The app ID value. */
        readonly appId: string;
        /** Whether the online option is enabled. */
        readonly online: boolean;
    }[];
    /** At most one prompt is shown; concurrent requests are serialized. */
    readonly approval?: ExternalAppApproval;
    /** Finalized registrations only. */
    readonly registrations: readonly ExternalAppRegistration[];
    /** Current Provider declarations; absent/unloaded Providers have no editable access. */
    readonly providers?: readonly (ExternalAppProvider & {
        /** Manifest-declared apps this Provider may discover and invoke. */
        readonly appIds: readonly string[];
    })[];
    /** Available adapter declarations, containing no executable code or resource values. */
    readonly descriptors?: readonly ExternalAppDescriptor[];
}

/** Shared SDK callback capability; retained as a host-side type alias. */
export type ExternalAppCallbackDescriptor = import('@kawaikara/site-api').ExternalAppCallback;
