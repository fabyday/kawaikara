import type { Disposable } from './Disposable';
import type { ExternalLoginOptions, SiteContext } from './SiteContext';
import { createLoginControlInjection } from './SiteUtilities';

/** Describes the site external login flow options contract. */
export interface SiteExternalLoginFlowOptions {
  /** The ID value. */
  readonly id: string;
  /** The action value. */
  readonly action?: string;
  /** The selector value. */
  readonly selector: string;
  /** The fallback labels value. */
  readonly fallbackLabels?: readonly string[];
  /** The login value. */
  readonly login: ExternalLoginOptions | (() => ExternalLoginOptions);
}

/** Describes the site external login flow contract. */
export interface SiteExternalLoginFlow extends Disposable {
  /** Handles the action. */
  handleAction(action: string): Promise<boolean>;
  /** Performs the refresh operation. */
  refresh(): Promise<void>;
}

/**
 * Registers a standard login-button bridge and owns pending-state, external
 * browser cleanup, reinjection, and diagnostics for its lifetime.
 */
export function createExternalLoginFlow(
  context: SiteContext,
  options: SiteExternalLoginFlowOptions,
): SiteExternalLoginFlow {
  if (!context.page) {
    throw new Error('External login interception requires script-injection.');
  }
  const action = options.action ?? 'login';
  const injectionId = `${options.id}.external-login`;
  const registration = context.page.register({
    id: injectionId,
    source: createLoginControlInjection({
      marker: `__kawaikaraExternalLogin_${options.id.replace(/[^a-z0-9]/gi, '_')}`,
      selector: options.selector,
      actionUrl: context.actions.createUrl(action),
      fallbackLabels: options.fallbackLabels,
    }),
  });
  let pending = false;
  let disposed = false;
  return {
    /** The handle action value. */
    handleAction: async (candidate) => {
      if (candidate !== action) return false;
      if (pending) return true;
      pending = true;
      try {
        const loginOptions = typeof options.login === 'function'
          ? options.login()
          : options.login;
        const result = await context.externalBrowser.login(loginOptions);
        context.logger.info(`${options.id} external login ${result}.`);
        // Site switching disposes the registration while an external browser
        // cancellation is still resolving. Do not refresh a page pipeline that
        // no longer owns this login bridge.
        if (!disposed) await context.page?.refresh(injectionId);
      } finally {
        pending = false;
      }
      return true;
    },
    /** The refresh value. */
    refresh: () => context.page?.refresh(injectionId) ?? Promise.resolve(),
    /** The dispose value. */
    dispose: () => {
      disposed = true;
      registration.dispose();
    },
  };
}
