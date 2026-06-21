export interface Scored {
  query: string;
  count: number;
  final?: number;
}

interface RecScore {
  score: number;
  lastUpdatedMs: number;
}

export class Scorer {
  private scores: Map<string, RecScore> = new Map();
  private lambda: number;
  private readonly boost = 1.0;

  constructor(halfLifeMs: number) {
    // lambda in per-second units, matching Go's math.Ln2 / halfLife.Seconds()
    this.lambda = Math.LN2 / (halfLifeMs / 1000);
  }

  record(query: string): void {
    const now = Date.now();
    const rs = this.scores.get(query);
    if (!rs) {
      this.scores.set(query, { score: this.boost, lastUpdatedMs: now });
      return;
    }
    const dtSeconds = (now - rs.lastUpdatedMs) / 1000;
    rs.score = rs.score * this.decayFactor(dtSeconds) + this.boost;
    rs.lastUpdatedMs = now;
  }

  scoreOf(query: string): number {
    const rs = this.scores.get(query);
    if (!rs) return 0;
    const dtSeconds = (Date.now() - rs.lastUpdatedMs) / 1000;
    return rs.score * this.decayFactor(dtSeconds);
  }

  private decayFactor(dtSeconds: number): number {
    return Math.exp(-this.lambda * dtSeconds);
  }

  rerank(items: Scored[], weight: number): Scored[] {
    for (const item of items) {
      item.final = item.count + weight * this.scoreOf(item.query);
    }
    items.sort((a, b) => {
      if (b.final !== a.final) return (b.final ?? 0) - (a.final ?? 0);
      return a.query < b.query ? -1 : a.query > b.query ? 1 : 0;
    });
    return items;
  }
}
