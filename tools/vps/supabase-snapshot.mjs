#!/usr/bin/env node
// Supabase → VPS 只读灾备：逐表 JSONL.gz + OpenAPI + Auth/Storage 清单。
// 正文只写 VPS 私有目录；终端仅输出计数、字节与 SHA-256，不输出用户内容或密钥。
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';

const HOME = process.env.HOME;
const ENV_FILES = [join(HOME, 'services/rescue-consumer/.env'), join(HOME, 'services/ledger-courier/.env')];
const BASE = 'https://nposjnafsbikwfeoudbg.supabase.co';
const ROOT = join(HOME, 'backups', 'supabase');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = join(ROOT, stamp);

function env() {
  const out = {};
  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (m && !(m[1] in out)) out[m[1]] = m[2].trim();
    }
  }
  if (!out.SUPABASE_SERVICE_KEY) throw new Error('missing SUPABASE_SERVICE_KEY');
  return out;
}

const e = env();
const H = { apikey: e.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_KEY}` };
mkdirSync(OUT, { recursive: true, mode: 0o700 });

async function request(path, options = {}) {
  const r = await fetch(BASE + path, { ...options, headers: { ...H, ...(options.headers || {}) } });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${(await r.text()).slice(0, 180)}`);
  return r;
}

const openapiResponse = await request('/rest/v1/', { headers: { Accept: 'application/openapi+json' } });
const openapi = await openapiResponse.json();
writeFileSync(join(OUT, 'postgrest-openapi.json'), JSON.stringify(openapi, null, 2), { mode: 0o600 });

const tables = Object.entries(openapi.paths || {})
  .filter(([path, ops]) => /^\/[A-Za-z_][A-Za-z0-9_]*$/.test(path) && ops && ops.get)
  .map(([path]) => path.slice(1)).sort();

async function writeGzipLines(file, lines) {
  await pipeline(Readable.from(lines), createGzip({ level: 9 }), createWriteStream(file, { mode: 0o600 }));
}

const manifest = { createdAt: new Date().toISOString(), source: 'supabase-rest-readonly', tables: {}, auth: {}, storage: {} };
for (const table of tables) {
  let offset = 0, count = 0, bytes = 0;
  // embedding 行很宽；一次取 500 条会在免费库临近限额时撞 statement timeout。
  // 缩小页只影响读取批次，不改变 JSONL 行或指纹语义。
  const pageSize = table === 'memory_embeddings' ? 100 : 500;
  const hash = createHash('sha256');
  const file = join(OUT, `table-${table}.jsonl.gz`);
  async function* lines() {
    for (;;) {
      const r = await request(`/rest/v1/${encodeURIComponent(table)}?select=*`, { headers: { Range: `${offset}-${offset + pageSize - 1}` } });
      const page = await r.json();
      if (!Array.isArray(page) || !page.length) break;
      for (const row of page) {
        const line = JSON.stringify(row) + '\n';
        hash.update(line); bytes += Buffer.byteLength(line); count += 1;
        yield line;
      }
      offset += page.length;
      if (page.length < pageSize) break;
    }
  }
  try {
    await writeGzipLines(file, lines());
    manifest.tables[table] = { count, jsonlBytes: bytes, sha256: hash.digest('hex'), state: 'ok' };
  } catch (error) {
    manifest.tables[table] = { count, jsonlBytes: bytes, state: 'error', error: String(error.message || error).slice(0, 240) };
  }
  console.log(JSON.stringify({ table, ...manifest.tables[table] }));
}

// Admin API 不返回密码哈希，但保留用户 UUID、邮箱、metadata 与时间戳，供新 Auth 重建身份。
let users = [], page = 1;
for (;;) {
  const data = await (await request(`/auth/v1/admin/users?page=${page}&per_page=1000`)).json();
  const rows = Array.isArray(data) ? data : (data.users || []);
  users.push(...rows);
  if (rows.length < 1000) break;
  page += 1;
}
const authLines = users.map(row => JSON.stringify(row) + '\n');
const authHash = createHash('sha256'); authLines.forEach(line => authHash.update(line));
await writeGzipLines(join(OUT, 'auth-users.jsonl.gz'), authLines);
manifest.auth = { count: users.length, sha256: authHash.digest('hex'), state: 'ok' };

const buckets = await (await request('/storage/v1/bucket')).json();
manifest.storage.buckets = [];
for (const bucket of buckets) {
  let offset = 0, objects = [];
  for (;;) {
    const pageRows = await (await request(`/storage/v1/object/list/${encodeURIComponent(bucket.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    })).json();
    objects.push(...pageRows);
    if (pageRows.length < 1000) break;
    offset += pageRows.length;
  }
  const safe = { id: bucket.id, name: bucket.name, public: !!bucket.public, objects };
  writeFileSync(join(OUT, `storage-${String(bucket.id).replace(/[^A-Za-z0-9_.-]/g, '_')}.json`), JSON.stringify(safe, null, 2), { mode: 0o600 });
  manifest.storage.buckets.push({ id: bucket.id, objects: objects.length, bytes: objects.reduce((n, x) => n + Number(x?.metadata?.size || 0), 0) });
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
writeFileSync(join(ROOT, 'LATEST'), stamp + '\n', { mode: 0o600 });
console.log(JSON.stringify({ ok: true, snapshot: stamp, directory: OUT, tables: Object.keys(manifest.tables).length, authUsers: users.length, storage: manifest.storage.buckets }));
