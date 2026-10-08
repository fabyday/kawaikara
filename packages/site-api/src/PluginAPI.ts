import type { Disposable } from './Disposable';
import type { VideoEffectsAPI } from './VideoEffects';
import type { ProviderSettings, SiteRequestDetails, SiteRequestRedirect } from './Provider';
import type { SiteActions, SiteLogger, SiteLocaleContext, SitePagePipeline } from './SiteContext';

/** A versioned, typed contract shared within one active Provider instance. */
export interface CapabilityToken<T extends object> {
  /** Stable, namespaced contract identifier. */
  readonly id: string;
  /** Incompatible contracts must use a different version. */
  readonly version: number;
  /** Compile-time contract witness; never read at runtime. */
  readonly contract?: T;
}

/** Define a method-only service contract without registering an implementation. */
export function defineCapability<T extends object>(id: string, version: number): CapabilityToken<T> {
  if (!id.trim() || !Number.isInteger(version) || version < 1) throw new Error('Invalid capability token.');
  return Object.freeze({
    /** Shared contract identity. */
    id,
    /** Explicit compatibility version. */
    version,
  });
}

/** Share contracts, never concrete Provider or Plugin class references. */
export interface CapabilityRegistry {
  /** Duplicate id/version ownership is rejected. */
  provide<T extends object>(token: CapabilityToken<T>, implementation: T): Disposable;
  /** Returns a revocable method-only facade, or undefined when unsupported. */
  get<T extends object>(token: CapabilityToken<T>): T | undefined;
}

/** App-managed request hooks. Higher priority runs first; cancellation always wins. */
export interface PluginNetworkAPI {
  /** Hooks observe the original request; the first redirect wins. */
  onBeforeRequest(handler: (request: SiteRequestDetails) => SiteRequestRedirect | undefined, priority?: number): Disposable;
}

/** Explicit namespaced action IDs; duplicate owners are rejected. */
export interface PluginActionsAPI extends SiteActions {
  /** Register a handled action without overriding Provider or Electron methods. */
  register(id: string, handler: () => void | Promise<void>): Disposable;
}

/** Persisted settings declared by this Plugin, including effective defaults. */
export interface PluginSettingsAPI {
  /** Detached snapshot, never the mutable application preference object. */
  get(): ProviderSettings;
  /** Observe saves while active; initial values are available in activate(). */
  onChanged(listener: (settings: ProviderSettings) => void | Promise<void>): Disposable;
}

/** App revokes authority before asynchronous Plugin cleanup. */
export interface PluginLifetime {
  /** Aborted on disable, failed activation, and Provider retirement. */
  readonly signal: AbortSignal;
  /** Cleanup is tracked even if a Plugin forgets to implement deactivate(). */
  track<T extends Disposable>(disposable: T): T;
}

/** Narrow services; not an Electron BrowserWindow or App attachment target. */
export interface PluginAppAPI {
  /** Permission-filtered and lifetime-scoped video processing service. */
  readonly videoEffects?: VideoEffectsAPI;
  /** App tags the logger with the Plugin id. */
  readonly logger: SiteLogger;
  /** Main resolves locale; translation resources remain Bundle-owned. */
  readonly locale?: SiteLocaleContext;
}

/** A Plugin cannot dispose its Provider's page pipeline. */
export type PluginPageAPI = Omit<SitePagePipeline, 'dispose'>;

/** Actual execution state is independent from the persisted desired state. */
export interface PluginRuntimeState {
  /** Registered Plugin identity. */
  readonly id: string;
  /** Desired state for this Provider, even if activation failed. */
  readonly enabled: boolean;
  /** Current App-managed execution state. */
  readonly state: 'inactive' | 'disabled' | 'active' | 'failed';
  /** Diagnostic text, never HTML. */
  readonly error?: string;
}
