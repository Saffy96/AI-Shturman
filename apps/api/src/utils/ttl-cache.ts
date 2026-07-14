interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500
  ) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    // Refresh insertion order so frequently used entries survive capacity
    // eviction without extending their TTL.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  peek(key: string): T | null {
    return this.entries.get(key)?.value ?? null;
  }

  set(key: string, value: T): void {
    this.removeExpired();
    this.entries.delete(key);
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value
    });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey == null) break;
      this.entries.delete(oldestKey);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
