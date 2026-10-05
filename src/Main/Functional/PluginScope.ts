import type { CapabilityRegistry, Disposable, PluginContext, PluginMetadata,
  PluginNetworkAPI, ProviderMetadata, ProviderSettings, SiteContext, SiteLogger } from '@kawaikara/site-api';
import { pluginActivation } from './PluginContributions';
import type { ScopedCapabilityRegistry } from './CapabilityRegistry';

/** Independent authority and registrations for exactly one Plugin activation. */
export class PluginScope {
  /** Cooperative cancellation for pending work. */
  private readonly abort = new AbortController();
  /** Cleanup continues after individual failures. */
  private readonly disposables = new Set<Disposable>();
  /** Saved values are cloned at the boundary. */
  private values: ProviderSettings;
  /** Active setting observers. */
  private readonly listeners = new Set<(settings: ProviderSettings) => void | Promise<void>>();
  /** Plugin identity and permission-restricted facades. */
  readonly context: PluginContext;

  /** Construct facades without giving Plugins ownership of the Provider pipeline. */
  constructor(
    source: SiteContext,
    provider: ProviderMetadata,
    /** Declared settings boundary and diagnostic identity. */
    private readonly metadata: PluginMetadata,
    values: ProviderSettings,
    registry: ScopedCapabilityRegistry,
    network: PluginNetworkAPI | undefined,
    registerAction: (id: string, handler: () => void | Promise<void>) => Disposable,
  ) {
    this.values = values;
    /** Auto-track registrations from every compatibility and current API. */
    const track = <T extends Disposable>(item: T): T => this.track(item);
    /** The host permission set applies to legacy APIs as well. */
    const requirePermission = (permission: NonNullable<ProviderMetadata['permissions']>[number]) => {
      if (!provider.permissions?.includes(permission)) throw new Error(`Plugin ${metadata.id} requires ${permission}.`);
    };
    const capabilities = registry.forScope(() => this.assertActive(), track);
    const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level,
      (message: string, ...args: unknown[]) => source.logger[level as keyof SiteLogger](`[plugin:${metadata.id}] ${message}`, ...args),
    ])) as unknown as SiteLogger;
    const page = source.page ? {
      /** Namespace all page registrations so Plugin ids cannot collide. */
      register: (injection: Parameters<NonNullable<SiteContext['page']>['register']>[0]) => {
        this.assertActive();
        const script = injection.source;
        return track(source.page!.register({ ...injection, id: `${metadata.id}:${injection.id}`, signal: this.abort.signal,
          source: typeof script === 'function' ? () => this.run(script) : script }));
      },
      /** Queued callbacks become inert immediately after revocation. */
      on: (phase: Parameters<NonNullable<SiteContext['page']>['on']>[0], listener: () => void | Promise<void>) => {
        this.assertActive();
        return track(source.page!.on(phase, () => this.abort.signal.aborted ? undefined : this.run(listener)));
      },
      /** Reinjection is limited to this Plugin's namespace. */
      refresh: (id: string) => this.run(() => source.page!.refresh(`${metadata.id}:${id}`)),
      /** Late results are rejected after revocation. */
      execute: <T>(id: string, script: string) => this.run(() => source.page!.execute<T>(`${metadata.id}:${id}`, script, this.abort.signal)),
      /** Original Provider pipeline owns frame iteration. */
      executeInAllFrames: <T>(id: string, script: string) => this.run(() => source.page!.executeInAllFrames<T>(`${metadata.id}:${id}`, script, this.abort.signal)),
      /** Never send input into a successor page. */
      sendKeyPress: (key: string) => { this.assertActive(); source.page!.sendKeyPress(key); },
    } : undefined;
    const actions = {
      /** URLs still use App's authenticated Provider action bridge. */
      createUrl: (id: string) => { this.assertActive(); return source.actions.createUrl(id); },
      /** App rejects duplicate owners; queued handlers are fenced twice. */
      register: (id: string, handler: () => void | Promise<void>) => {
        this.assertActive(); return track(registerAction(id, () => this.run(handler)));
      },
    };
    // Keep the v1 provider facade for compatibility, but revoke every side effect
    // independently from the Provider and auto-track every registration.
    const providerFacade: SiteContext & { metadata: ProviderMetadata } = {
      ...source, metadata: provider, capabilities, logger, actions,
      page: page ? { ...page, dispose: () => { /* App alone owns the pipeline. */ } } : undefined,
      viewer: {
        loadURL: url => this.run(() => { requirePermission('navigation'); return source.viewer.loadURL(url); }),
        loadInternalView: id => this.run(() => { requirePermission('internal-view'); return source.viewer.loadInternalView(id); }),
      },
      browser: source.browser ? { useIdentity: options => {
        this.assertActive(); return track(source.browser!.useIdentity(options));
      } } : undefined,
      cookies: source.cookies ? {
        list: query => this.run(() => source.cookies!.list(query)),
        clear: query => this.run(() => source.cookies!.clear(query)),
      } : undefined,
      externalBrowser: {
        login: options => this.run(() => { requirePermission('external-browser'); return source.externalBrowser.login(options); }),
        close: () => this.run(() => { requirePermission('external-browser'); return source.externalBrowser.close(); }),
      },
      openExternal: url => this.run(() => { requirePermission('external-browser'); return source.openExternal(url); }),
    };
    this.context = {
      app: { logger, locale: source.locale }, provider: providerFacade, page, actions, capabilities,
      network: network ? { onBeforeRequest: (handler, priority) => {
        this.assertActive();
        return track(network.onBeforeRequest(request => {
          this.assertActive(); return handler(request);
        }, priority));
      } } : undefined,
      settings: {
        get: () => { this.assertActive(); return this.snapshot(); },
        onChanged: listener => {
          this.assertActive(); this.listeners.add(listener);
          return track({ dispose: () => { this.listeners.delete(listener); } });
        },
      },
      lifetime: { signal: this.abort.signal, track },
    };
  }

  /** Persisted values arrive from Main, never from direct Plugin writes. */
  async update(values: ProviderSettings): Promise<void> {
    this.assertActive();
    const previous = JSON.stringify(this.snapshot());
    this.values = values;
    if (JSON.stringify(this.snapshot()) === previous) return;
    for (const listener of this.listeners) await this.run(() => listener(this.snapshot()));
  }

  /** Revoke now; caller may await Plugin.deactivate separately. Idempotent. */
  retire(): void {
    if (this.abort.signal.aborted) return;
    this.abort.abort();
    for (const item of [...this.disposables].reverse()) {
      try { item.dispose(); }
      catch (error) { this.context.app.logger.error('Plugin cleanup failed.', error); }
    }
    this.disposables.clear(); this.listeners.clear();
  }

  /** Immediately dispose late registrations instead of leaking them. */
  private track<T extends Disposable>(item: T): T {
    let disposed = false;
    const wrapper = new Proxy(item, {
      get: (target, property) => property === 'dispose' ? () => {
        if (disposed) return;
        disposed = true; this.disposables.delete(wrapper); target.dispose();
      } : Reflect.get(target, property),
    });
    if (this.abort.signal.aborted) wrapper.dispose();
    else this.disposables.add(wrapper);
    return wrapper;
  }

  /** Fence both issuance and completion of asynchronous work. */
  private async run<T>(operation: () => T | Promise<T>): Promise<T> {
    this.assertActive(); const result = await operation(); this.assertActive(); return result;
  }

  /** Detached values include only this Plugin's declared keys and defaults. */
  private snapshot(): ProviderSettings {
    return structuredClone(Object.fromEntries([pluginActivation(this.metadata), ...(this.metadata.settings ?? [])].map(setting => [
      setting.key, setting.type === 'boolean'
        ? (typeof this.values[setting.key] === 'boolean' ? this.values[setting.key] : setting.defaultValue)
        : (Array.isArray(this.values[setting.key]) ? this.values[setting.key] : []),
    ])));
  }

  /** One disabled Plugin cannot retain authority through its still-active Provider. */
  private assertActive(): void {
    if (this.abort.signal.aborted) throw new Error(`Plugin ${this.metadata.id} is no longer active.`);
  }
}
