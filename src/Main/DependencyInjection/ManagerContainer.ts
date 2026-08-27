/** Describes the manager token contract. */
export interface ManagerToken<T> {
  /** The key value. */
  readonly key: symbol;
  /** The name value. */
  readonly name: string;
  /** Callback used to handle manager type. */
  readonly managerType?: (manager: T) => T;
}

/** Describes the manager resolver contract. */
export interface ManagerResolver {
  /** Resolves the operation. */
  resolve<T>(token: ManagerToken<T>): T;
}

/** Defines the manager factory type. */
export type ManagerFactory<T> = (resolver: ManagerResolver) => T;

/** Describes the singleton registration contract. */
interface SingletonRegistration<T> {
  /** The factory value. */
  readonly factory: ManagerFactory<T>;
  /** The instance value. */
  instance?: T;
  /** Whether the initialized option is enabled. */
  initialized: boolean;
  /** Whether the resolving option is enabled. */
  resolving: boolean;
}

/** Creates the manager token. */
export function createManagerToken<T>(name: string): ManagerToken<T> {
  return {
    /** The key value. */
    key: Symbol(name),
    /** The name value. */
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
  /** The registrations value. */
  private readonly registrations = new Map<
    symbol,
    SingletonRegistration<unknown>
  >();

  /** Registers the singleton. */
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

  /** Registers the value. */
  registerValue<T>(token: ManagerToken<T>, instance: T): this {
    return this.registerSingleton(token, () => instance);
  }

  /** Replaces the singleton. */
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

  /** Determines whether the unnamed declaration condition applies. */
  has(token: ManagerToken<unknown>): boolean {
    return this.registrations.has(token.key);
  }

  /** Resolves the operation. */
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
