import type { Disposable } from './Disposable';

export type NewWindowPolicy =
  | 'external'
  | 'viewer'
  | 'popup'
  | 'deny'
  | 'default';

export type ExternalLoginResult = 'completed' | 'cancelled';

export interface ExternalLoginOptions {
  readonly startUrl: string;
  /** A regular-expression source matched against the external page URL. */
  readonly completionUrlPattern: string;
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

export interface SiteExternalBrowser {
  login(options: ExternalLoginOptions): Promise<ExternalLoginResult>;
  close(): Promise<void>;
}

export interface SiteCookieMetadata {
  readonly name: string;
  readonly domain: string;
}

export interface SiteCookieQuery {
  /** HTTPS host names. A parent host also includes its subdomains. */
  readonly domains: readonly string[];
}

export interface SiteCookieClearOptions extends SiteCookieQuery {
  /** Omit to remove every cookie in the requested domains. */
  readonly names?: readonly string[];
}

export interface SiteCookieStore {
  /** Returns cookie names and domains only. Cookie values are never exposed. */
  list(options: SiteCookieQuery): Promise<readonly SiteCookieMetadata[]>;
  clear(options: SiteCookieClearOptions): Promise<number>;
}

export interface SiteActions {
  createUrl(action: string): string;
}

export interface SiteViewer {
  loadURL(url: string): Promise<void>;
  loadInternalView(viewId: string): Promise<void>;
  getUserAgent(): string;
  setUserAgent(userAgent?: string): void;
  executeJavaScript<T = unknown>(code: string): Promise<T>;
  /** Execute the same page-world script in the main document and every child frame. */
  executeJavaScriptInAllFrames<T = unknown>(code: string): Promise<readonly T[]>;
  /** Send one trusted keyboard press through Electron to the active page. */
  sendKeyPress(key: string): void;
  onDomReady(listener: () => void | Promise<void>): Disposable;
  onDidFinishLoad(listener: () => void | Promise<void>): Disposable;
  /** Fires after either the main document or an embedded frame finishes loading. */
  onFrameReady(listener: () => void | Promise<void>): Disposable;
}

export interface SiteLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface SiteLocaleContext {
  /** Resolved app locale, or system when Electron should use the OS locale. */
  readonly app: string;
  /** Resolved locale for the Bundle that owns the current Provider. */
  readonly plugin: string;
  /** Resolved locale for the current site. */
  readonly site: string;
}

export interface SiteContext {
  readonly viewer: SiteViewer;
  readonly logger: SiteLogger;
  readonly actions: SiteActions;
  readonly externalBrowser: SiteExternalBrowser;
  /** Available only to Providers that declare the cookies permission. */
  readonly cookies?: SiteCookieStore;
  /** Optional in Site API v1 for source compatibility. */
  readonly locale?: SiteLocaleContext;
  openExternal(url: string): Promise<void>;
}
