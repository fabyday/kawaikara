export interface Disposable {
  dispose(): void;
}

export class DisposableStore implements Disposable {
  private readonly items = new Set<Disposable>();
  private disposed = false;

  add<T extends Disposable>(item: T): T {
    if (this.disposed) {
      item.dispose();
      return item;
    }

    this.items.add(item);
    return item;
  }

  clear(): void {
    for (const item of this.items) {
      try {
        item.dispose();
      } finally {
        this.items.delete(item);
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.clear();
  }
}
