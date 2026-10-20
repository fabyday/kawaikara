import type {
    ExternalAppDescriptor,
    ExternalAppRequest,
    ExternalAppResult,
} from '@kawaikara/site-api';

/** Cookie snapshot returned only to an approved app over its authenticated transport. */
export interface ExternalAppCookie {
    /** Cookie name. */
    readonly name: string;
    /** Secret value; must never enter logs, deep links or Renderer IPC. */
    readonly value: string;
    /** Domain supplied by the browser cookie store. */
    readonly domain: string;
    /** Matching request path. */
    readonly path: string;
    /** Transport confidentiality restriction. */
    readonly secure: boolean;
    /** Whether page JavaScript is forbidden from reading the cookie. */
    readonly httpOnly: boolean;
    /** Unix expiry in seconds, absent for session cookies. */
    readonly expirationDate?: number;
}

/** Trusted invocation source, selected by Kawaikara rather than app-controlled parameters. */
export interface ExternalAppResource {
    /** Main-selected Provider; absent resources cannot request Provider cookies. */
    readonly provider?: import('../../../Common/ExternalApps').ExternalAppProvider;
    /** Validated Provider URL for this one invocation. */
    readonly url: string;
    /** Reads only cookies applicable to this URL in the selected Provider profile. */
    readCookies(): Promise<readonly ExternalAppCookie[]>;
    /** Revokes a saved resource when its Provider registration is replaced or removed. */
    isActive(): boolean;
}

/** Host API given to adapter functions; every call enforces current registration/grants. */
export interface ExternalAppHost {
    /** Returns whether one declared permission is currently granted for this resource. */
    hasPermission(permissionId: string): boolean;
    /** Reads the invocation URL under a declared resource.url permission. */
    getUrl(permissionId: string): string;
    /** Reads cookies under a declared cookies.read permission and rechecks after the read. */
    getCookies(permissionId: string): Promise<readonly ExternalAppCookie[]>;
}

/** App-supplied integration. Kawaikara never evaluates remotely downloaded adapter JavaScript. */
export interface ExternalAppAdapter {
    /** Data declaration reviewed before final registration. */
    readonly descriptor: ExternalAppDescriptor;
    /** Rechecks installation without requesting secrets or launching the app. */
    discover(): Promise<
        | {
              /** Installed version when native discovery exposes it. */ readonly version?: string;
          }
        | undefined
    >;
    /** Validates its own action parameters and uses only permission-checked host resources. */
    execute(
        request: ExternalAppRequest,
        host: ExternalAppHost,
    ): Promise<ExternalAppResult>;
}
