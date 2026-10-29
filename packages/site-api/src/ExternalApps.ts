/** Kawaikara-owned resources an external adapter may request. */
export type ExternalAppPermissionKind = 'resource.url' | 'cookies.read';

/** One independently approvable resource access declaration supplied by an adapter. */
export interface ExternalAppPermission {
    /** Adapter-local identifier referenced by action requirements. */
    readonly id: string;
    /** Host operation whose implementation remains inside Kawaikara. */
    readonly kind: ExternalAppPermissionKind;
    /** Exact HTTPS origins; cookies never use a wildcard domain grant. */
    readonly origins: readonly string[];
}

/** An adapter-owned function, with no built-in media/download semantics. */
export interface ExternalAppAction {
    /** Function name chosen by the external app. */
    readonly id: string;
    /** Grants required to enable this action; other declared permissions remain optional. */
    readonly permissions: readonly string[];
}

/** Registration declaration supplied by an external app's trusted transport adapter. */
export interface ExternalAppDescriptor {
    /** Host descriptor format, independent of the app's action protocol. */
    readonly schemaVersion: 1;
    /** Stable product identity. */
    readonly id: string;
    /** App-supplied display name. */
    readonly name: string;
    /** Changes whenever the adapter's behavior or protocol changes. */
    readonly revision: string;
    /** Individually approvable requests, including optional access. */
    readonly permissions: readonly ExternalAppPermission[];
    /** Functions exported by this app's adapter. */
    readonly actions: readonly ExternalAppAction[];
}

/** Public installation and registration snapshot, without native paths or secret data. */
export interface ExternalAppInfo {
    /** Stable application identity. */
    readonly id: string;
    /** Human-readable application name. */
    readonly name: string;
    /** Installed version when discoverable. */
    readonly version?: string;
    /** True only after the user finalized registration for this descriptor. */
    readonly registered: boolean;
    /** Adapter actions; missing required grants disable individual functions. */
    readonly actions: readonly (ExternalAppAction & {
        /** Whether this action has all of its declared required grants. */
        readonly enabled: boolean;
    })[];
}

/** Opaque adapter-owned call; the manager does not interpret application parameters. */
export interface ExternalAppRequest {
    /** Exported adapter function name. */
    readonly action: string;
    /** Function-specific input validated by the external app's adapter. */
    readonly parameters?: unknown;
}

/** Acceptance means handed off to the application, not completion of its background job. */
export type ExternalAppResult =
    | {
          /** The transport accepted the handoff. */
          readonly accepted: true;
          /** Correlation identity, when supported by the transport. */
          readonly requestId?: string;
          /** Optional function result whose schema belongs to this adapter. */
          readonly value?: unknown;
      }
    | {
          /** No handoff was accepted. */
          readonly accepted: false;
          /** Adapter-specific failure or unavailable/permission-denied/unsupported-action. */
          readonly code: string;
          /** Whether user action or application recovery may allow a retry. */
          readonly recoverable: boolean;
      };

/** Narrow Provider-facing facade, with no registration, installer or executable authority. */
export interface ExternalApps {
    /**
     * Discovers an application again on every call.
     * @param appId - Stable application identity.
     * @returns Public metadata, or undefined when unknown or not currently installed.
     * @throws If discovery fails unexpectedly.
     */
    find(appId: string): Promise<ExternalAppInfo | undefined>;
    /**
     * Revalidates availability and dispatches a versioned adapter action.
     * @param appId - Application selected by the Provider.
     * @param request - Adapter-owned action identity and optional parameters.
     * @returns Handoff result; missing apps and disabled actions are ordinary failures.
     * @throws If the adapter fails to discover or launch the application.
     */
    request(
        appId: string,
        request: ExternalAppRequest,
    ): Promise<ExternalAppResult>;
}

/** Per-invocation callback capability. Never persist or expose it to a renderer. */
export interface ExternalAppCallback {
    /** Opaque request correlation identity. */
    readonly requestId: string;
    /** Authenticated loopback event endpoint; append /host for host operations. */
    readonly callbackUrl: string;
    /** Secret bearer credential scoped to this invocation. */
    readonly token: string;
}

/** Permission-checked resources available while preparing an application handoff. */
export interface ExternalAppLaunchContext {
    /** Callback capability for the receiving external app. */
    readonly callback: ExternalAppCallback;
    /** Checks the current grant for a declared permission. */
    hasPermission(permissionId: string): boolean;
    /** Reads the invocation URL after rechecking its resource.url grant. */
    getUrl(permissionId: string): string;
}

/**
 * Provider-owned adapter for an external application's protocol.
 * The host supplies discovery, native launch, callbacks and resource permissions.
 * Only code shipped in the loaded Bundle implements this contract; manifests never supply executable code.
 */
export interface ExternalAppIntegration {
    /** Application-owned identity, actions and permission requirements. */
    readonly descriptor: ExternalAppDescriptor;
    /** Registered custom URL scheme; http, file and other general-purpose schemes are forbidden. */
    readonly protocol: string;
    /**
     * Serializes an app-specific request using only scoped host resources.
     * @param request - Provider-selected action and opaque parameters.
     * @param context - URL capability and invocation callback credentials.
     * @returns A URL using exactly this integration's declared protocol.
     * @throws Invalid app-specific parameters or denied host access.
     */
    createLaunchUrl(request: ExternalAppRequest, context: ExternalAppLaunchContext): string;
    /**
     * Validates authenticated app-specific events; the host does not interpret their payload.
     * @param value - Untrusted decoded event, bounded by the host transport.
     * @param requestId - Expected host-issued correlation ID.
     * @returns True to retire the callback after the fixed duplicate-delivery grace period.
     * @throws Invalid app-specific event data.
     */
    onEvent?(value: unknown, requestId: string): boolean;
}
