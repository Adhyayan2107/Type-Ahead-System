import express from 'express';
import path from 'path';
import { Store } from '../store/store';
import { Trie } from '../trie/trie';
import { WriteBuffer } from '../buffer/buffer';
import { Cache } from '../cache/cache';
import { Scorer } from '../trending/trending';
import { createRouter } from '../api/handlers';

const CONN_STR = process.env['DATABASE_URL']
  ?? 'postgres://typeahead:typeahead@localhost:5433/typeahead?sslmode=disable';

async function main(): Promise<void> {
  const store = new Store(CONN_STR);
  await store.connect();
  console.log('connected to postgres');

  const trie = new Trie(10);
  const start = Date.now();
  let loaded = 0;
  await store.loadAll(qc => {
    trie.insert(qc.query, qc.count);
    loaded++;
  });
  trie.build();
  console.log(`loaded ${loaded} queries, built trie in ${Date.now() - start}ms`);

  const buf = new WriteBuffer(store, 1000, 5_000);
  const cache = new Cache(3, 100, 60_000);
  const trending = new Scorer(30_000);

  const app = express();
  app.use(express.json());
  app.use(createRouter(trie, cache, buf, trending, 5000.0));
  app.use(express.static(path.join(__dirname, '../../web')));

  const server = app.listen(8080, () => {
    console.log('listening on :8080');
  });

  const shutdown = async (): Promise<void> => {
    console.log('shutting down...');
    server.close();
    await buf.close();
    await store.close();
    console.log('bye');
    process.exit(0);
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

main().catch(err => {
  console.error('fatal:', err);
  process.exit(1);
});
