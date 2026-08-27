/** Describes the disposable contract. */
export interface Disposable {
  /** Releases the operation. */
  dispose(): void;
}

/** Represents the disposable store. */
export class DisposableStore implements Disposable {
  /** The items value. */
  private readonly items = new Set<Disposable>();
  /** The disposed value. */
  private disposed = false;

  /** Performs the add operation. */
  add<T extends Disposable>(item: T): T {
    if (this.disposed) {
      item.dispose();
      return item;
    }

    this.items.add(item);
    return item;
  }

  /** Clears the operation. */
  clear(): void {
    for (const item of this.items) {
      try {
        item.dispose();
      } finally {
        this.items.delete(item);
      }
    }
  }

  /** Releases the operation. */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.clear();
  }
}
