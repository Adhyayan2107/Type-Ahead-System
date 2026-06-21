import { Pool, types } from 'pg';

// Parse PostgreSQL BIGINT as JS number (safe up to 2^53 for search counts)
types.setTypeParser(20, (val: string) => parseInt(val, 10));

export interface QueryCount {
  query: string;
  count: number;
}

export class Store {
  private pool: Pool;

  constructor(connString: string) {
    this.pool = new Pool({ connectionString: connString });
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    client.release();
  }

  async initSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS queries (
        query TEXT PRIMARY KEY,
        count BIGINT NOT NULL
      )`);
  }

  async upsertCounts(increments: Map<string, number>): Promise<void> {
    if (increments.size === 0) return;
    const promises = Array.from(increments).map(([q, inc]) =>
      this.pool.query(
        `INSERT INTO queries (query, count) VALUES ($1, $2)
         ON CONFLICT (query) DO UPDATE SET count = queries.count + EXCLUDED.count`,
        [q, inc]
      )
    );
    await Promise.all(promises);
  }

  async loadAll(fn: (qc: QueryCount) => void, limit = 200_000): Promise<void> {
    const result = await this.pool.query(
      'SELECT query, count FROM queries ORDER BY count DESC LIMIT $1',
      [limit]
    );
    for (const row of result.rows as { query: string; count: number }[]) {
      fn({ query: row.query, count: row.count });
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
