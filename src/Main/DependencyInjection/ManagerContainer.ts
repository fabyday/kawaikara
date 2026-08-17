export interface ManagerToken<T> {
  readonly key: symbol;
  readonly name: string;
  readonly managerType?: (manager: T) => T;
}

export interface ManagerResolver {
  resolve<T>(token: ManagerToken<T>): T;
}

export type ManagerFactory<T> = (resolver: ManagerResolver) => T;

interface SingletonRegistration<T> {
  readonly factory: ManagerFactory<T>;
  instance?: T;
  initialized: boolean;
  resolving: boolean;
}

export function createManagerToken<T>(name: string): ManagerToken<T> {
  return {
    key: Symbol(name),
    name,
  };
}

/**
 * Application-scoped manager composition container.
 *
 * Managers receive their dependencies through constructors. They must not keep
 * or resolve this container themselves; only the application composition root
 * should use it.
 */
export class ManagerContainer implements ManagerResolver {
  private readonly registrations = new Map<
    symbol,
    SingletonRegistration<unknown>
  >();

  registerSingleton<T>(
    token: ManagerToken<T>,
    factory: ManagerFactory<T>,
  ): this {
    if (this.registrations.has(token.key)) {
      throw new Error(`Manager ${token.name} is already registered.`);
    }
    this.registrations.set(token.key, {
      factory: factory as ManagerFactory<unknown>,
      initialized: false,
      resolving: false,
    });
    return this;
  }

  registerValue<T>(token: ManagerToken<T>, instance: T): this {
    return this.registerSingleton(token, () => instance);
  }

  replaceSingleton<T>(
    token: ManagerToken<T>,
    factory: ManagerFactory<T>,
  ): this {
    const current = this.registrations.get(token.key);
    if (current?.initialized || current?.resolving) {
      throw new Error(`Resolved manager ${token.name} cannot be replaced.`);
    }
    this.registrations.delete(token.key);
    return this.registerSingleton(token, factory);
  }

  has(token: ManagerToken<unknown>): boolean {
    return this.registrations.has(token.key);
  }

  resolve<T>(token: ManagerToken<T>): T {
    const registration = this.registrations.get(token.key) as
      | SingletonRegistration<T>
      | undefined;
    if (!registration) {
      throw new Error(`Manager ${token.name} is not registered.`);
    }
    if (registration.initialized) {
      return registration.instance as T;
    }
    if (registration.resolving) {
      throw new Error(`Circular manager dependency detected at ${token.name}.`);
    }

    registration.resolving = true;
    try {
      registration.instance = registration.factory(this);
      registration.initialized = true;
      return registration.instance;
    } finally {
      registration.resolving = false;
    }
  }
}
