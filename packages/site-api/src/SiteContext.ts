import type { Disposable } from './Disposable';

/** Defines the new window policy type. */
export type NewWindowPolicy =
  | 'external'
  | 'viewer'
  | 'popup'
  | 'deny'
  | 'default';

/** Defines the external login result type. */
export type ExternalLoginResult = 'completed' | 'cancelled';

/** Describes the external login options contract. */
export interface ExternalLoginOptions {
  /** The start URL value. */
  readonly startUrl: string;
  /**
   * Activate a login control once the temporary browser has rendered the
   * start page. This avoids asking the user to repeat the click that already
   * initiated external login in Kawaikara.
   */
  readonly autoActivate?: {
    /** The selector value. */
    readonly selector: string;
    /** The fallback labels value. */
    readonly fallbackLabels?: readonly string[];
  };
  /** A regular-expression source matched against the external page URL. */
  readonly completionUrlPattern: string;
  /** The completion URL flags value. */
  readonly completionUrlFlags?: string;
  /** Viewer URL restored after the external login browser closes. */
  readonly returnUrl?: string;
  /** Human-readable site name displayed by the temporary login view. */
  readonly siteTitle?: string;
  /** Locale used by the temporary login view. */
  readonly locale?: string;
  /**
   * HTTPS origins whose existing site data is cleared before the external
   * browser's cookies are imported. Use only for sites whose login state is
   * not safe to merge with an existing embedded-browser session.
   */
  readonly resetSessionOrigins?: readonly string[];
  /**
   * Replace every cookie in the target Electron Session with the completed
   * external browser's cookie jar. The external browser remains temporary;
   * no browser storage other than cookies is transferred.
   */
  readonly replaceSessionCookies?: boolean;
  /**
   * Seed the temporary external browser with the target Session's cookies.
   * Use only with a dedicated authentication profile. This preserves existing
   * accounts when a service opens an add-account flow.
   */
  readonly seedSessionCookies?: boolean;
  /**
   * Cookie conversion used while importing the completed browser cookie jar.
   * `domain-scoped-https` matches the legacy main-branch behavior required by
   * services whose anti-bot cookies depend on Chromium's HTTPS source scope.
   */
  readonly cookieImportMode?: 'preserve-source' | 'domain-scoped-https';
  /** Wait for the external browser process to close before restoring the viewer. */
  readonly awaitBrowserCleanup?: boolean;
  /** Milliseconds the captured cookie jar must remain unchanged before import. */
  readonly cookieSettleMs?: number;
}

/** Describes the site external browser contract. */
export interface SiteExternalBrowser {
  /** Performs the login operation. */
  login(options: ExternalLoginOptions): Promise<ExternalLoginResult>;
  /** Closes the operation. */
  close(): Promise<void>;
}

/** Describes the site cookie metadata contract. */
export interface SiteCookieMetadata {
  /** The name value. */
  readonly name: string;
  /** The domain value. */
  readonly domain: string;
}

/** Describes the site cookie query contract. */
export interface SiteCookieQuery {
  /** HTTPS host names. A parent host also includes its subdomains. */
  readonly domains: readonly string[];
}

/** Describes the site cookie clear options contract. */
export interface SiteCookieClearOptions extends SiteCookieQuery {
  /** Omit to remove every cookie in the requested domains. */
  readonly names?: readonly string[];
}

/** Describes the site cookie store contract. */
export interface SiteCookieStore {
  /** Returns cookie names and domains only. Cookie values are never exposed. */
  list(options: SiteCookieQuery): Promise<readonly SiteCookieMetadata[]>;
  /** Clears the operation. */
  clear(options: SiteCookieClearOptions): Promise<number>;
}

/** Describes the site actions contract. */
export interface SiteActions {
  /** Creates the URL. */
  createUrl(action: string): string;
}

/** Describes the site browser identity options contract. */
export interface SiteBrowserIdentityOptions {
  /** `chromium` removes Electron/application product tokens from the current UA. */
  readonly userAgent: 'chromium' | string;
  /** HTTPS hosts receiving the identity headers. Omit to cover every HTTPS request. */
  readonly requestHosts?: readonly string[];
  /** `auto` derives a matching Chromium Client Hint from the UA. */
  readonly clientHints?: 'auto' | string;
}

/** Describes the site browser contract. */
export interface SiteBrowser {
  /** Applies the identity to the viewer, popups, and matching requests until disposed. */
  useIdentity(options: SiteBrowserIdentityOptions): Disposable;
}

/** Describes the site viewer contract. */
export interface SiteViewer {
  /** Loads the URL. */
  loadURL(url: string): Promise<void>;
  /** Loads the internal view. */
  loadInternalView(viewId: string): Promise<void>;
}

/** Defines the site page phase type. */
export type SitePagePhase = 'dom-ready' | 'did-finish-load' | 'frame-ready';
/** Defines the site page frame scope type. */
export type SitePageFrameScope = 'main' | 'all';

/** Describes the site page injection contract. */
export interface SitePageInjection {
  /** Stable, Provider-scoped name used in diagnostics. */
  readonly id: string;
  /** Rebuilt before every pass so settings and action URLs can stay current. */
  readonly source: string | (() => string | Promise<string>);
  /** Defaults to dom-ready and did-finish-load. */
  readonly phases?: readonly SitePagePhase[];
  /** Defaults to the main document. */
  readonly frames?: SitePageFrameScope;
  /** Also install immediately in the current document. Defaults to false. */
  readonly runImmediately?: boolean;
}

/**
 * Application-owned page pipeline. It centralizes document lifecycle retries,
 * frame traversal, failure isolation, diagnostics, and teardown for Providers.
 */
export interface SitePagePipeline {
  /** Registers the operation. */
  register(injection: SitePageInjection): Disposable;
  /** Performs the refresh operation. */
  refresh(id: string): Promise<void>;
  /** Executes the operation. */
  execute<T = unknown>(id: string, source: string): Promise<T>;
  /** Executes the in all frames. */
  executeInAllFrames<T = unknown>(id: string, source: string): Promise<readonly T[]>;
  /** Handles the operation. */
  on(phase: SitePagePhase, listener: () => void | Promise<void>): Disposable;
  /** Send one trusted keyboard press to the active page. */
  sendKeyPress(key: string): void;
  /** @internal Kawaikara owns the pipeline lifecycle. */
  dispose(): void;
}

/** Describes the site logger contract. */
export interface SiteLogger {
  /** Performs the debug operation. */
  debug(message: string, ...args: unknown[]): void;
  /** Performs the info operation. */
  info(message: string, ...args: unknown[]): void;
  /** Performs the warn operation. */
  warn(message: string, ...args: unknown[]): void;
  /** Performs the error operation. */
  error(message: string, ...args: unknown[]): void;
}

/** Describes the site locale context contract. */
export interface SiteLocaleContext {
  /** Resolved app locale, or system when Electron should use the OS locale. */
  readonly app: string;
  /** Resolved locale for the Bundle that owns the current Provider. */
  readonly plugin: string;
  /** Resolved locale for the current site. */
  readonly site: string;
}

/** Describes the site context contract. */
export interface SiteContext {
  /** The viewer value. */
  readonly viewer: SiteViewer;
  /** Available only with the network-interception permission. */
  readonly browser?: SiteBrowser;
  /** Available only to Providers that declare the script-injection permission. */
  readonly page?: SitePagePipeline;
  /** The logger value. */
  readonly logger: SiteLogger;
  /** The actions value. */
  readonly actions: SiteActions;
  /** The external browser value. */
  readonly externalBrowser: SiteExternalBrowser;
  /** Available only to Providers that declare the cookies permission. */
  readonly cookies?: SiteCookieStore;
  /** Optional in Site API v1 for source compatibility. */
  readonly locale?: SiteLocaleContext;
  /** Opens the external. */
  openExternal(url: string): Promise<void>;
}
