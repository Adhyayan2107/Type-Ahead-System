import { Suggestion } from '../trie/trie';
import { Ring } from './ring';
import { CacheNode, NodeStats } from './node';

export class Cache {
  private ring: Ring;
  private nodes: Map<string, CacheNode> = new Map();

  constructor(numNodes: number, replicas: number, ttlMs: number) {
    this.ring = new Ring(replicas);
    for (let i = 0; i < numNodes; i++) {
      const name = `node${i}`;
      this.ring.addNode(name);
      this.nodes.set(name, new CacheNode(name, ttlMs));
    }
  }

  get(prefix: string): [Suggestion[], boolean] {
    const owner = this.ring.getNode(prefix);
    return this.nodes.get(owner)!.get(prefix);
  }

  set(prefix: string, suggestions: Suggestion[]): void {
    const owner = this.ring.getNode(prefix);
    this.nodes.get(owner)!.set(prefix, suggestions);
  }

  ownerOf(prefix: string): string {
    return this.ring.getNode(prefix);
  }

  debug(prefix: string): { owner: string; hit: boolean } {
    const owner = this.ring.getNode(prefix);
    const [, hit] = this.nodes.get(owner)!.get(prefix);
    return { owner, hit };
  }

  allStats(): NodeStats[] {
    return Array.from(this.nodes.values()).map(n => n.getStats());
  }
}
