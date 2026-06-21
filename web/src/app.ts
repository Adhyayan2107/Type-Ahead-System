const getEl = (id: string): HTMLElement => document.getElementById(id)!;

let mode = 'basic';
let activeIdx = -1;
let items: Array<{ query: string; count: number }> = [];

function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function fetchSuggestions(prefix: string): Promise<void> {
  if (!prefix) {
    hideDropdown();
    getEl('s-prefix').textContent = '—';
    return;
  }
  const url = `/suggest?q=${encodeURIComponent(prefix)}${mode === 'trending' ? '&mode=trending' : ''}`;
  const t0 = performance.now();
  let data: Array<{ query: string; count: number }>;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('bad status ' + res.status);
    data = await res.json() as Array<{ query: string; count: number }>;
  } catch {
    renderError();
    return;
  }
  const ms = (performance.now() - t0).toFixed(1);
  items = data;
  renderDropdown(data);
  getEl('s-prefix').textContent = prefix;
  getEl('s-latency').textContent = ms + ' ms';
  void refreshCacheDebug(prefix);
}

async function refreshCacheDebug(prefix: string): Promise<void> {
  try {
    const res = await fetch(`/cache/debug?prefix=${encodeURIComponent(prefix)}`);
    const d = await res.json() as { node: string; hit: boolean };
    getEl('s-node').textContent = d.node || '—';
    getEl('s-cache').innerHTML = d.hit
      ? '<span class="badge hit">HIT</span>'
      : '<span class="badge miss">MISS</span>';
  } catch { /* non-fatal */ }
}

function renderDropdown(data: Array<{ query: string; count: number }>): void {
  const dd = getEl('dropdown');
  activeIdx = -1;
  if (!data || data.length === 0) {
    dd.innerHTML = '<div class="empty">No matches. Keep typing or try another prefix.</div>';
    dd.classList.add('show');
    return;
  }
  dd.innerHTML = data.map((s, i) =>
    `<div class="item" data-i="${i}">
       <span class="term">${escapeHtml(s.query)}</span>
       <span class="cnt">${s.count.toLocaleString()}</span>
     </div>`
  ).join('');
  dd.classList.add('show');
  dd.querySelectorAll<HTMLElement>('.item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset['i']);
      void submit(data[idx]?.query);
    });
  });
}

function renderError(): void {
  const dd = getEl('dropdown');
  dd.innerHTML = '<div class="empty">Couldn\'t reach the server. Is it running on :8080?</div>';
  dd.classList.add('show');
}

function hideDropdown(): void {
  getEl('dropdown').classList.remove('show');
}

async function submit(query?: string): Promise<void> {
  const input = getEl('q') as HTMLInputElement;
  const q = query ?? input.value;
  if (!q.trim()) return;
  input.value = q;
  hideDropdown();
  try {
    const res = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    });
    const d = await res.json() as { message: string };
    getEl('result').innerHTML =
      `server response: <b>${escapeHtml(d.message)}</b> · query "${escapeHtml(q)}" recorded`;
  } catch {
    getEl('result').textContent = 'search failed — server unreachable';
  }
  void refreshStats();
  void refreshTrending();
}

async function refreshStats(): Promise<void> {
  try {
    const d = await (await fetch('/stats')).json() as {
      searches_received: number;
      db_flushes: number;
      rows_written: number;
    };
    getEl('s-recv').textContent = String(d.searches_received);
    getEl('s-flush').textContent = String(d.db_flushes);
    getEl('s-rows').textContent = String(d.rows_written);
    if (d.searches_received > 0 && d.rows_written > 0) {
      const factor = (d.searches_received / d.rows_written).toFixed(1);
      getEl('s-reduce').textContent = `${factor}× fewer writes`;
    }
  } catch { /* non-fatal */ }
}

async function refreshTrending(): Promise<void> {
  const p = (getEl('q') as HTMLInputElement).value.trim() || 'a';
  try {
    const d = await (await fetch(`/suggest?q=${encodeURIComponent(p)}&mode=trending`))
      .json() as Array<{ query: string; count: number }>;
    const box = getEl('trending');
    if (!d || d.length === 0) {
      box.innerHTML = '<div class="empty">No trending data yet.</div>';
      return;
    }
    box.innerHTML = d.slice(0, 8).map((s, i) =>
      `<div class="trend-item"><span class="rank">${i + 1}</span><span>${escapeHtml(s.query)}</span></div>`
    ).join('');
  } catch { /* non-fatal */ }
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return String(s).replace(/[&<>"']/g, c => map[c] ?? c);
}

getEl('q').addEventListener('keydown', (e: Event) => {
  const ke = e as KeyboardEvent;
  const els = getEl('dropdown').querySelectorAll('.item');
  if (ke.key === 'ArrowDown') {
    ke.preventDefault();
    activeIdx = Math.min(activeIdx + 1, els.length - 1);
    paintActive(els);
  } else if (ke.key === 'ArrowUp') {
    ke.preventDefault();
    activeIdx = Math.max(activeIdx - 1, 0);
    paintActive(els);
  } else if (ke.key === 'Enter') {
    if (activeIdx >= 0 && items[activeIdx]) void submit(items[activeIdx]!.query);
    else void submit();
  } else if (ke.key === 'Escape') {
    hideDropdown();
  }
});

function paintActive(els: NodeListOf<Element>): void {
  els.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
}

const debounced = debounce((v: string) => { void fetchSuggestions(v); }, 150);
(getEl('q') as HTMLInputElement).addEventListener('input', (e: Event) => {
  debounced((e.target as HTMLInputElement).value.trim());
});
getEl('go').addEventListener('click', () => { void submit(); });

document.querySelectorAll<HTMLElement>('.mode').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach(m => m.classList.remove('active'));
    el.classList.add('active');
    mode = el.dataset['mode'] ?? 'basic';
    getEl('s-mode').textContent = mode;
    const val = (getEl('q') as HTMLInputElement).value.trim();
    if (val) void fetchSuggestions(val);
  });
});

void refreshStats();
void refreshTrending();
