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
}

export interface SiteExternalBrowser {
  login(options: ExternalLoginOptions): Promise<ExternalLoginResult>;
  close(): Promise<void>;
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
  /** Optional in Site API v1 for source compatibility. */
  readonly locale?: SiteLocaleContext;
  openExternal(url: string): Promise<void>;
}
