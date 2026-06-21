import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { Store } from '../store/store';

const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='));
const dbArg = args.find(a => a.startsWith('--db='));

const filePath = fileArg?.split('=')[1];
const connStr = dbArg?.split('=')[1]
  ?? 'postgres://typeahead:typeahead@localhost:5433/typeahead?sslmode=disable';

if (!filePath) {
  console.error('need --file=path/to/aol.txt');
  process.exit(1);
}

async function main(): Promise<void> {
  const store = new Store(connStr);
  await store.connect();
  await store.initSchema();

  const counts = new Map<string, number>();
  const rl = createInterface({
    input: createReadStream(filePath as string),
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  const start = Date.now();

  for await (const line of rl) {
    lineNo++;
    if (lineNo === 1) continue; // skip header row
    const fields = line.split('\t');
    if (fields.length < 2) continue;
    const query = fields[1]!.toLowerCase().trim();
    if (!query || query === '-') continue;
    counts.set(query, (counts.get(query) ?? 0) + 1);
  }

  console.log(`read ${lineNo - 1} lines, ${counts.size} unique queries in ${Date.now() - start}ms`);

  const CHUNK_SIZE = 5000;
  let chunk = new Map<string, number>();
  let written = 0;

  const flush = async (): Promise<void> => {
    if (chunk.size === 0) return;
    await store.upsertCounts(chunk);
    written += chunk.size;
    chunk = new Map();
  };

  for (const [q, c] of counts) {
    chunk.set(q, c);
    if (chunk.size >= CHUNK_SIZE) await flush();
  }
  await flush();

  console.log(`wrote ${written} unique queries to postgres in ${Date.now() - start}ms`);
  await store.close();
}

main().catch(err => {
  console.error('fatal:', err);
  process.exit(1);
});
