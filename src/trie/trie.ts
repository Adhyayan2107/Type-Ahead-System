export interface Suggestion {
  query: string;
  count: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  isWord: boolean;
  word: string;
  count: number;
  topK: Suggestion[];
}

function makeNode(): TrieNode {
  return { children: new Map(), isWord: false, word: '', count: 0, topK: [] };
}

export class Trie {
  private root: TrieNode;
  private topKSize: number;

  constructor(topK: number) {
    this.root = makeNode();
    this.topKSize = topK;
  }

  insert(query: string, count: number): void {
    let cur = this.root;
    for (const ch of query) {
      if (!cur.children.has(ch)) {
        cur.children.set(ch, makeNode());
      }
      cur = cur.children.get(ch)!;
    }
    cur.isWord = true;
    cur.word = query;
    cur.count = count;
  }

  build(): void {
    this.computeTopK(this.root);
  }

  private computeTopK(n: TrieNode): Suggestion[] {
    let candidates: Suggestion[] = [];
    for (const child of n.children.values()) {
      candidates.push(...this.computeTopK(child));
    }
    if (n.isWord) {
      candidates.push({ query: n.word, count: n.count });
    }
    candidates.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.query < b.query ? -1 : a.query > b.query ? 1 : 0;
    });
    if (candidates.length > this.topKSize) {
      candidates = candidates.slice(0, this.topKSize);
    }
    n.topK = candidates;
    return candidates;
  }

  search(prefix: string): Suggestion[] {
    let cur = this.root;
    for (const ch of prefix) {
      if (!cur.children.has(ch)) return [];
      cur = cur.children.get(ch)!;
    }
    return [...cur.topK];
  }
}
