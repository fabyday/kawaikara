import type { CapabilityRegistry, CapabilityToken, Disposable } from '@kawaikara/site-api';

/** One activation's service registry. No global registrations survive a site switch. */
export class ScopedCapabilityRegistry {
  /** Entries retain identity so replacement cannot revive a stale facade. */
  private readonly entries = new Map<string, object>();
  /** Public operations are fenced for both the owner and the consuming scope. */
  forScope(assertActive: () => void, track: <T extends Disposable>(item: T) => T): CapabilityRegistry {
    return {
      /** Track only this scope's registration. */
      provide: <T extends object>(token: CapabilityToken<T>, implementation: T): Disposable => {
        assertActive();
        const key = this.key(token);
        if (this.entries.has(key)) throw new Error(`Capability already registered: ${key}`);
        this.entries.set(key, implementation);
        return track({ dispose: () => {
          if (this.entries.get(key) === implementation) this.entries.delete(key);
        } });
      },
      /** Export method facades, not a mutable implementation object. */
      get: <T extends object>(token: CapabilityToken<T>): T | undefined => {
        assertActive();
        const key = this.key(token);
        const implementation = this.entries.get(key);
        if (!implementation) return undefined;
        /** Both producer and consumer must still own their activation. */
        const check = () => {
          assertActive();
          if (this.entries.get(key) !== implementation) throw new Error(`Capability retired: ${key}`);
        };
        return new Proxy(Object.create(null), {
          get: (_target, property) => {
            check();
            const method = Reflect.get(implementation, property);
            if (typeof method !== 'function') return undefined;
            return (...args: unknown[]) => {
              check();
              const result = Reflect.apply(method, implementation, args);
              if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
                return Promise.resolve(result).then(value => { check(); return value; });
              }
              check();
              return result;
            };
          },
          set: () => false,
        }) as T;
      },
    };
  }

  /** Runtime validation also covers untyped installed JavaScript bundles. */
  private key(token: CapabilityToken<object>): string {
    if (!token.id?.trim() || !Number.isInteger(token.version) || token.version < 1) {
      throw new Error('Invalid capability token.');
    }
    return `${token.id}@${token.version}`;
  }
}
