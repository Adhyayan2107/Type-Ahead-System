import { Ring } from '../cache/ring';

const r = new Ring(100);
r.addNode('node0');
r.addNode('node1');
r.addNode('node2');

const prefixes = ['goog', 'ip', 'java', 'map', 'ebay', 'yahoo', 'amaz', 'face', 'twit', 'red', 'net', 'you'];

const before = new Map<string, string>();
console.log('--- with 3 nodes ---');
for (const p of prefixes) {
  const owner = r.getNode(p);
  before.set(p, owner);
  console.log(`${p.padEnd(6)} -> ${owner}`);
}

r.addNode('node3');
console.log('\n--- after adding node3 ---');
let moved = 0;
for (const p of prefixes) {
  const owner = r.getNode(p);
  const prev = before.get(p)!;
  const status = owner !== prev ? `(MOVED from ${prev})` : '(same)';
  if (owner !== prev) moved++;
  console.log(`${p.padEnd(6)} -> ${owner} ${status}`);
}

console.log(`\n${moved} of ${prefixes.length} prefixes moved when adding a node (~1/N expected)`);
