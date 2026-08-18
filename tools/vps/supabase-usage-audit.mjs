// 只读 Supabase 盘点：打印各业务表行数与 Storage 对象体积，不输出密钥或正文。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOME = process.env.HOME;
const ENV_FILES = [join(HOME, 'services/rescue-consumer/.env'), join(HOME, 'services/ledger-courier/.env')];
const BASE = 'https://nposjnafsbikwfeoudbg.supabase.co';
const TABLES = [
  'saves', 'chat_archive', 'chat_messages', 'server_inbox', 'cc_read_inbox', 'desk_log',
  'memories', 'memory_embeddings', 'memory_conflicts', 'memory_correction_audit',
  'memory_correction_candidates', 'memory_events', 'memory_event_links', 'memory_event_candidates',
  'character_sleep_presence', 'user_tidal_state', 'photo_bridge_index', 'push_subs',
  'rescue_remote_commands', 'yanqiu_moments', 'yanqiu_moment_comments',
];

function env() {
  const out = {};
  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (m && !(m[1] in out)) out[m[1]] = m[2].trim();
    }
  }
  if (!out.SUPABASE_SERVICE_KEY || !out.TARGET_USER) throw new Error('missing Supabase audit credentials');
  return out;
}

const e = env();
const headers = { apikey: e.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' };
const rows = [];
for (const table of TABLES) {
  const r = await fetch(`${BASE}/rest/v1/${table}?select=*`, { headers });
  if (r.status === 404 || r.status === 400) { rows.push({ table, count: null, state: 'not_exposed_or_absent' }); continue; }
  const range = r.headers.get('content-range') || '';
  const count = Number(range.split('/')[1]);
  rows.push({ table, count: Number.isFinite(count) ? count : null, state: r.ok ? 'ok' : `http_${r.status}` });
}

let storage = { objects: null, bytes: null, state: 'not_available' };
const br = await fetch(`${BASE}/storage/v1/bucket`, { headers });
if (br.ok) {
  const buckets = await br.json();
  const byBucket = {};
  for (const bucket of buckets) {
    let offset = 0, objects = [];
    for (;;) {
      const r = await fetch(`${BASE}/storage/v1/object/list/${encodeURIComponent(bucket.id)}`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
      });
      if (!r.ok) break;
      const page = await r.json();
      objects.push(...page);
      if (page.length < 1000) break;
      offset += page.length;
    }
    byBucket[bucket.id] = { objects: objects.length, bytes: objects.reduce((n, row) => n + Number(row?.metadata?.size || 0), 0) };
  }
  storage = {
    objects: Object.values(byBucket).reduce((n, row) => n + row.objects, 0),
    bytes: Object.values(byBucket).reduce((n, row) => n + row.bytes, 0),
    byBucket, state: 'ok',
  };
}

console.log(JSON.stringify({ auditedAt: new Date().toISOString(), tables: rows, storage }, null, 2));
