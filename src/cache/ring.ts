// CRC32-IEEE lookup table (matches Go's crc32.ChecksumIEEE)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(str: string): number {
  const bytes = Buffer.from(str, 'utf8');
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return ((crc ^ 0xffffffff) >>> 0);
}

export class Ring {
  private keys: number[] = [];
  private hashMap: Map<number, string> = new Map();

  constructor(private replicas: number) {}

  private hash(s: string): number {
    return crc32(s);
  }

  addNode(name: string): void {
    for (let i = 0; i < this.replicas; i++) {
      const h = this.hash(`${name}#${i}`);
      this.keys.push(h);
      this.hashMap.set(h, name);
    }
    this.keys.sort((a, b) => a - b);
  }

  removeNode(name: string): void {
    this.keys = this.keys.filter(h => {
      if (this.hashMap.get(h) === name) {
        this.hashMap.delete(h);
        return false;
      }
      return true;
    });
  }

  getNode(key: string): string {
    if (this.keys.length === 0) return '';
    const h = this.hash(key);
    // Binary search for first key >= h (mirrors Go's sort.Search)
    let lo = 0, hi = this.keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.keys[mid]! < h) lo = mid + 1;
      else hi = mid;
    }
    const idx = lo === this.keys.length ? 0 : lo;
    return this.hashMap.get(this.keys[idx]!)!;
  }
}
