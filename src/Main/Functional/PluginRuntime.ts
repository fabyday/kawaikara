import type { AbstractPlugin, CapabilityRegistry, Disposable, PluginRuntimeState,
  ProviderMetadata, ProviderSettings, SiteContext, SiteRequestDetails, SiteRequestRedirect } from '@kawaikara/site-api';
import { ScopedCapabilityRegistry } from './CapabilityRegistry';
import { PluginScope } from './PluginScope';
import { isPluginEnabled } from './PluginContributions';
import type { RegisteredRuntimePlugin } from './SiteRuntime';

/** Captured instance and its independently revocable authority. */
interface ActivePlugin {
  /** User code lifecycle. */
  readonly instance: AbstractPlugin;
  /** Host-owned registrations and cancellation. */
  readonly scope: PluginScope;
}

/** An action belongs to exactly one active Plugin. */
interface PluginActionRegistration {
  /** Owner used for failure isolation. */
  readonly owner: string;
  /** Revocable handler supplied by PluginScope. */
  readonly handler: () => void | Promise<void>;
}

/** Stable, synchronous request policy contribution. */
interface PluginRequestRegistration {
  /** Owner used for failure isolation. */
  readonly owner: string;
  /** Higher priority is consulted first. */
  readonly priority: number;
  /** Receives the original request, not another hook's redirect. */
  readonly handler: (request: SiteRequestDetails) => SiteRequestRedirect | undefined;
}

/** Host-owned Plugin execution for exactly one Provider activation. */
export class PluginRuntime {
  /** Versioned Provider/Plugin contribution contracts. */
  private readonly registry = new ScopedCapabilityRegistry();
  /** Reverse-order shutdown uses insertion order. */
  private readonly active = new Map<string, ActivePlugin>();
  /** Execution status is separate from the user's enabled preference. */
  private readonly states = new Map<string, PluginRuntimeState>();
  /** Only one Plugin can own a given action id. */
  private readonly actions = new Map<string, PluginActionRegistration>();
  /** Stable registration order breaks equal-priority ties. */
  private readonly requests = new Set<PluginRequestRegistration>();
  /** Provider-owned capability registrations. */
  private readonly providerResources: Disposable[] = [];
  /** Plugin failures can finish teardown asynchronously without retaining authority. */
  private readonly pending = new Set<Promise<void>>();
  /** Retired runtimes cannot be revived by a queued settings save. */
  private retired = false;
  /** Facade supplied to Provider code and App consumers. */
  readonly capabilities: CapabilityRegistry;

  /** Scope all registrations to the host Provider's permission set. */
  constructor(
    /** Permission-filtered services from the active Provider. */
    private readonly source: SiteContext,
    /** Canonical identity and granted permissions. */
    private readonly provider: ProviderMetadata,
  ) {
    this.capabilities = this.registry.forScope(() => {
      if (this.retired) throw new Error('Provider capabilities are no longer active.');
    }, item => { this.providerResources.push(item); return item; });
  }

  /** Apply desired state; only changed live settings notify active Plugins. */
  async sync(registrations: readonly RegisteredRuntimePlugin[], settings: ProviderSettings): Promise<void> {
    if (this.retired) return;
    const registeredIds = new Set(registrations.map(registration => registration.metadata.id));
    for (const id of this.active.keys()) if (!registeredIds.has(id)) this.stop(id);
    for (const id of this.states.keys()) if (!registeredIds.has(id)) this.states.delete(id);
    for (const registration of registrations) {
      if (this.retired) return;
      const metadata = registration.metadata;
      const enabled = isPluginEnabled(metadata, settings);
      if (!enabled) {
        this.stop(metadata.id);
        this.states.set(metadata.id, { id: metadata.id, enabled, state: 'disabled' });
        continue;
      }
      const active = this.active.get(metadata.id);
      if (active) {
        try { await active.scope.update(settings); }
        catch (error) { if (this.active.get(metadata.id) === active) this.fail(metadata.id, error); }
        continue;
      }
      if (this.states.get(metadata.id)?.state === 'failed') continue;
      let scope: PluginScope | undefined;
      let instance: AbstractPlugin | undefined;
      try {
        scope = new PluginScope({ ...this.source,
          page: this.provider.permissions?.includes('script-injection') ? this.source.page : undefined,
          browser: this.provider.permissions?.includes('network-interception') ? this.source.browser : undefined,
          cookies: this.provider.permissions?.includes('cookies') ? this.source.cookies : undefined,
        }, this.provider, metadata, settings, this.registry,
          this.provider.permissions?.includes('network-interception') ? {
            onBeforeRequest: (handler, priority = 0) => {
              if (!Number.isFinite(priority)) throw new Error('Plugin hook priority must be finite.');
              const entry = { owner: metadata.id, priority, handler };
              this.requests.add(entry);
              return { dispose: () => { this.requests.delete(entry); } };
            },
          } : undefined,
          (id, handler) => {
            if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/.test(id) || this.actions.has(id)) throw new Error(`Duplicate or invalid Plugin action: ${id}`);
            const entry = { owner: metadata.id, handler };
            this.actions.set(id, entry);
            return { dispose: () => { if (this.actions.get(id) === entry) this.actions.delete(id); } };
          });
        instance = new registration.constructor(scope.context);
        this.active.set(metadata.id, { instance, scope });
        await instance.activate();
        if (this.retired) { this.stop(metadata.id); return; }
        if (this.active.get(metadata.id)?.instance !== instance) continue;
        this.states.set(metadata.id, { id: metadata.id, enabled, state: 'active' });
      } catch (error) {
        scope?.retire();
        if (!instance || this.active.get(metadata.id)?.instance === instance) this.fail(metadata.id, error);
      }
    }
  }

  /** Handle Plugin actions first; unknown IDs remain Provider-owned. */
  async handleAction(id: string): Promise<boolean> {
    const action = this.actions.get(id);
    if (!action || this.retired) return false;
    try { await action.handler(); }
    catch (error) { if (this.actions.get(id) === action) this.fail(action.owner, error); }
    return true;
  }

  /** Cancellation overrides every redirect; equal priorities preserve registration order. */
  transformRequest(request: SiteRequestDetails, base?: SiteRequestRedirect): SiteRequestRedirect | undefined {
    if (this.retired) return base;
    if (base?.cancel) return base;
    let redirect = base;
    const original = Object.freeze({ ...request, requestHeaders: Object.freeze({ ...request.requestHeaders }) });
    for (const entry of [...this.requests].sort((a, b) => b.priority - a.priority)) {
      if (!this.requests.has(entry)) continue;
      try {
        const result = entry.handler(original);
        if (result && typeof result === 'object' && 'then' in result) {
          void Promise.resolve(result).catch(error => this.source.logger.error(`Plugin ${entry.owner} returned an asynchronous request hook.`, error));
        }
        if (result && (typeof result !== 'object' || 'then' in result ||
            (result.cancel !== undefined && typeof result.cancel !== 'boolean') ||
            (result.redirectURL !== undefined && (typeof result.redirectURL !== 'string' ||
              !['https:', 'http:'].includes(new URL(result.redirectURL).protocol))))) {
          throw new Error('Plugin request hooks must return a synchronous cancel or HTTP(S) redirect decision.');
        }
        if (result?.cancel) return {
          /** Cancellation always wins over redirects. */
          cancel: true,
        };
        if (!redirect?.redirectURL && result?.redirectURL) redirect = result;
      } catch (error) { this.fail(entry.owner, error); }
    }
    return redirect;
  }

  /** Snapshots are safe to expose through the existing Bundle runtime IPC. */
  listStates(): PluginRuntimeState[] { return [...this.states.values()].map(state => ({ ...state })); }

  /** Synchronously revoke all authority, then await captured reverse-order deactivation. */
  retire(): Promise<void> {
    if (!this.retired) {
      this.retired = true;
      const entries = [...this.active.entries()].reverse();
      for (const [, entry] of entries) entry.scope.retire();
      this.active.clear(); this.actions.clear(); this.requests.clear();
      for (const resource of this.providerResources.splice(0).reverse()) {
        try { resource.dispose(); } catch (error) { this.source.logger.error('Capability cleanup failed.', error); }
      }
      this.trackCleanup((async () => {
        for (const [id, entry] of entries) await this.deactivate(id, entry);
      })());
    }
    return Promise.all([...this.pending]).then(() => undefined);
  }

  /** Disabling removes registrations before any user-supplied async cleanup. */
  private stop(id: string): void {
    const entry = this.active.get(id);
    if (!entry) return;
    this.active.delete(id); entry.scope.retire();
    this.trackCleanup(this.deactivate(id, entry));
  }

  /** Cleanup failure cannot stop other Plugins from releasing their resources. */
  private async deactivate(id: string, entry: ActivePlugin): Promise<void> {
    try { await entry.instance.deactivate(); }
    catch (error) { this.source.logger.error(`Plugin ${id} deactivation failed.`, error); }
  }

  /** Keep failed activations isolated from the Provider while exposing diagnostic status. */
  private fail(id: string, error: unknown): void {
    this.stop(id);
    if (this.retired) return;
    this.states.set(id, { id, enabled: true, state: 'failed', error: error instanceof Error ? error.message : String(error) });
    this.source.logger.error(`Plugin ${id} failed.`, error);
  }

  /** Retain cleanup promises until settled so retirement can drain outstanding work. */
  private trackCleanup(task: Promise<void>): void {
    this.pending.add(task); void task.finally(() => this.pending.delete(task));
  }
}
