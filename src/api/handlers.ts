import { Request, Response, Router } from 'express';
import { Trie, Suggestion } from '../trie/trie';
import { Cache } from '../cache/cache';
import { WriteBuffer } from '../buffer/buffer';
import { Scorer, Scored } from '../trending/trending';

export function createRouter(
  trie: Trie,
  cache: Cache,
  buf: WriteBuffer,
  trending: Scorer,
  weight: number
): Router {
  const router = Router();

  router.get('/suggest', (req: Request, res: Response) => {
    const prefix = ((req.query['q'] as string) ?? '').toLowerCase().trim();
    const mode = req.query['mode'] as string | undefined;

    if (mode === 'trending') {
      const base = trie.search(prefix);
      const scored: Scored[] = base.map(s => ({ query: s.query, count: s.count }));
      const reranked = trending.rerank(scored, weight);
      const out: Suggestion[] = reranked.map(s => ({ query: s.query, count: s.count }));
      res.json(out);
      return;
    }

    const [cached, hit] = cache.get(prefix);
    if (hit) {
      res.json(cached);
      return;
    }

    const results = trie.search(prefix);
    cache.set(prefix, results);
    res.json(results);
  });

  router.post('/search', (req: Request, res: Response) => {
    const body = req.body as { query?: string };
    const query = (body.query ?? '').toLowerCase().trim();
    if (!query) {
      res.status(400).json({ error: 'empty query' });
      return;
    }
    buf.add(query);
    trending.record(query);
    res.json({ message: 'Searched' });
  });

  router.get('/stats', (_req: Request, res: Response) => {
    const { adds, flushes, writes } = buf.stats();
    res.json({
      searches_received: adds,
      db_flushes: flushes,
      rows_written: writes,
    });
  });

  router.get('/cache/debug', (req: Request, res: Response) => {
    const prefix = ((req.query['prefix'] as string) ?? '').toLowerCase().trim();
    const { owner, hit } = cache.debug(prefix);
    res.json({ prefix, node: owner, hit });
  });

  router.get('/cache/stats', (_req: Request, res: Response) => {
    res.json(cache.allStats());
  });

  return router;
}
