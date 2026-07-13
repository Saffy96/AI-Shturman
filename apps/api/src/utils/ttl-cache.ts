interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  peek(key: string): T | null {
    return this.entries.get(key)?.value ?? null;
  }

  set(key: string, value: T): void {
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}
