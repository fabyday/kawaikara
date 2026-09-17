import type { SiteContext } from '@kawaikara/site-api';

/** Provider capabilities whose authority can be revoked before async teardown. */
export interface ScopedSiteContext {
  /** Capabilities given to the Provider and its Plugins. */
  readonly context: SiteContext;
  /** Revokes authority synchronously and starts only this context's login close. */
  retire(): Promise<void>;
}

/** Prevents late outgoing cleanup from navigating, authenticating, or mutating a successor. */
export function createScopedSiteContext(source: SiteContext): ScopedSiteContext {
  let active = true;
  let retirement: Promise<void> | undefined;
  /** Requires ownership even when the old native document is not destroyed yet. */
  const requireActive = (): void => {
    if (!active) throw new Error('The site context is no longer active.');
  };
  const page = source.page;
  return {
    /** Preserve read-only locale/logger/action values and fence side effects. */
    context: {
      ...source,
      /** The old viewer may never invoke global PiP/internal-view transitions. */
      viewer: {
        /** Starts navigation only while this Provider owns the context. */
        loadURL: async (url) => { requireActive(); await source.viewer.loadURL(url); },
        /** Switches app-owned surfaces only while this Provider is current. */
        loadInternalView: async (id) => { requireActive(); await source.viewer.loadInternalView(id); },
      },
      /** Closing a retired context must not cancel the next Provider's login. */
      externalBrowser: {
        /** Rejects a late outgoing login action. */
        login: async (options) => { requireActive(); return source.externalBrowser.login(options); },
        /** Retirement already started this context's close exactly once. */
        close: () => active ? source.externalBrowser.close() : Promise.resolve(),
      },
      /** Revoke old UA/header changes before the successor installs its identity. */
      browser: source.browser ? {
        /** Acquires identity only for the current Provider. */
        useIdentity: (options) => { requireActive(); return source.browser!.useIdentity(options); },
      } : undefined,
      /** Shared Sessions do not grant a retired Provider continued cookie authority. */
      cookies: source.cookies ? {
        /** Reads only while this context is current. */
        list: async (options) => { requireActive(); return source.cookies!.list(options); },
        /** Rejects late outgoing cookie changes. */
        clear: async (options) => { requireActive(); return source.cookies!.clear(options); },
      } : undefined,
      /** Fences saved pipeline references as well as newly registered hooks. */
      page: page ? {
        ...page,
        /** Rejects registrations by already retired asynchronous handlers. */
        register: (injection) => { requireActive(); return page.register(injection); },
        /** A callback queued before retirement becomes inert afterward. */
        on: (phase, listener) => {
          requireActive();
          return page.on(phase, () => active ? listener() : undefined);
        },
        /** Rejects reinjection after retirement. */
        refresh: async (id) => { requireActive(); await page.refresh(id); },
        /** An execution still targets the original document, never the successor. */
        execute: async <T>(id: string, script: string): Promise<T> => {
          requireActive(); return page.execute<T>(id, script);
        },
        /** Rejects new frame operations by a retired Provider. */
        executeInAllFrames: async <T>(id: string, script: string): Promise<readonly T[]> => {
          requireActive(); return page.executeInAllFrames<T>(id, script);
        },
        /** Input must not outlive the active Provider. */
        sendKeyPress: (key) => { requireActive(); page.sendKeyPress(key); },
      } : undefined,
      /** A late outgoing Plugin cannot open a new user browser window. */
      openExternal: async (url) => { requireActive(); await source.openExternal(url); },
    },
    /** Capture and initiate close now; never look up the active login later. */
    retire: () => {
      if (retirement) return retirement;
      active = false;
      page?.dispose();
      try {
        retirement = Promise.resolve(source.externalBrowser.close());
      } catch (error) {
        retirement = Promise.reject(error);
      }
      // Consumers may await the tracked promise after other cleanup hooks.
      void retirement.catch(() => undefined);
      return retirement;
    },
  };
}
