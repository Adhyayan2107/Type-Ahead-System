// Named WriteBuffer to avoid collision with Node.js built-in Buffer
export interface Flusher {
  upsertCounts(increments: Map<string, number>): Promise<void>;
}

export class WriteBuffer {
  private counts: Map<string, number> = new Map();
  private totalAdds = 0;
  private totalFlush = 0;
  private totalWrites = 0;
  private timer: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(
    private flusher: Flusher,
    private maxSize: number,
    flushIntervalMs: number
  ) {
    this.timer = setInterval(() => { void this.flush(); }, flushIntervalMs);
  }

  add(query: string): void {
    this.counts.set(query, (this.counts.get(query) ?? 0) + 1);
    this.totalAdds++;
    if (this.counts.size >= this.maxSize) {
      void this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.counts.size === 0) return;
    this.flushing = true;
    const batch = this.counts;
    this.counts = new Map();
    this.totalFlush++;
    this.totalWrites += batch.size;
    try {
      await this.flusher.upsertCounts(batch);
    } catch (e) {
      console.error(`buffer flush failed (${batch.size} queries lost):`, e);
    } finally {
      this.flushing = false;
    }
  }

  stats(): { adds: number; flushes: number; writes: number } {
    return { adds: this.totalAdds, flushes: this.totalFlush, writes: this.totalWrites };
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }
}
