import { Suggestion } from '../trie/trie';

interface Entry {
  suggestions: Suggestion[];
  expiresAt: number;
}

export interface NodeStats {
  name: string;
  size: number;
  hits: number;
  misses: number;
}

// Node.js is single-threaded so no channel/goroutine pattern needed —
// direct map access is already race-free in the event loop.
export class CacheNode {
  private store: Map<string, Entry> = new Map();
  private hits = 0;
  private misses = 0;

  constructor(public readonly name: string, private ttlMs: number) {}

  get(prefix: string): [Suggestion[], boolean] {
    const e = this.store.get(prefix);
    if (!e) {
      this.misses++;
      return [[], false];
    }
    if (Date.now() > e.expiresAt) {
      this.store.delete(prefix);
      this.misses++;
      return [[], false];
    }
    this.hits++;
    return [e.suggestions, true];
  }

  set(prefix: string, suggestions: Suggestion[]): void {
    this.store.set(prefix, {
      suggestions,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  getStats(): NodeStats {
    return {
      name: this.name,
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
