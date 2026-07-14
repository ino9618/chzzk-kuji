export class SequentialEventQueue<T> {
  private active: T | null = null;
  private readonly pending: T[] = [];

  enqueue(item: T): T | null {
    if (this.active === null) {
      this.active = item;
      return item;
    }
    this.pending.push(item);
    return null;
  }

  complete(): T | null {
    this.active = this.pending.shift() ?? null;
    return this.active;
  }

  clear(): void {
    this.active = null;
    this.pending.length = 0;
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}
