#!/usr/bin/env node
import { readFileSync, createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { once } from "node:events";

const root = process.argv[2];
if (!root) throw new Error("usage: import-snapshot.mjs <snapshot-directory>");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const tables = Object.keys(manifest.tables || {}).sort();
if (!tables.length || tables.some((name) => !/^[a-z][a-z0-9_]*$/.test(name))) {
  throw new Error("snapshot contains no tables or an unsafe table name");
}
const incomplete = tables.filter((name) => manifest.tables[name]?.state !== "ok");
if (incomplete.length) throw new Error(`snapshot is incomplete; refusing to truncate: ${incomplete.join(",")}`);

const dockerArgs = ["docker", "compose", "exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-q", "-U", "postgres"];
const truncateSql = `truncate table ${tables.map((t) => `public.${t}`).join(",")} restart identity cascade;`;
const reset = spawnSync("sudo", [...dockerArgs, "-c", truncateSql], {
  cwd: "/home/ubuntu/services/lisa-cloud", stdio: "inherit"
});
if (reset.status !== 0) throw new Error(`truncate failed: ${reset.status}`);

const copyEscape = (s) => s.replaceAll("\\", "\\\\").replaceAll("\t", "\\t").replaceAll("\r", "\\r");

for (const table of tables) {
  const source = join(root, `table-${table}.jsonl.gz`);
  const psql = spawn("sudo", dockerArgs, {
    cwd: "/home/ubuntu/services/lisa-cloud", stdio: ["pipe", "inherit", "inherit"]
  });
  const write = async (s) => { if (!psql.stdin.write(s)) await once(psql.stdin, "drain"); };
  await write(`
begin;
set local session_replication_role = replica;
create temp table lisa_snapshot_import(payload jsonb not null) on commit drop;
copy lisa_snapshot_import(payload) from stdin;
`);
  let seen = 0;
  const lines = createInterface({ input: createReadStream(source).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    JSON.parse(line);
    await write(copyEscape(line) + "\n");
    seen++;
  }
  await write(`\\.
insert into public.${table} overriding system value
select (jsonb_populate_record(null::public.${table}, payload)).*
from lisa_snapshot_import;

with src as (
  select to_jsonb(jsonb_populate_record(null::public.${table}, payload)) as row_data
  from lisa_snapshot_import
), dst as (
  select to_jsonb(t) as row_data from public.${table} t
), delta as (
  (select row_data from src except all select row_data from dst)
  union all
  (select row_data from dst except all select row_data from src)
)
select 'VERIFY ${table} rows=' || (select count(*) from dst) || ' mismatches=' || count(*) from delta;
commit;
`);
  psql.stdin.end();
  const status = await new Promise((resolve, reject) => {
    psql.once("exit", resolve);
    psql.once("error", reject);
  });
  if (status !== 0) throw new Error(`import failed for ${table}: ${status}`);
  const expected = Number(manifest.tables[table]?.count ?? -1);
  if (seen !== expected) throw new Error(`source count changed for ${table}: ${seen} != ${expected}`);
}

const sequence = spawnSync("sudo", [...dockerArgs, "-c",
  "select setval(pg_get_serial_sequence('public.desk_log','id'), greatest(coalesce(max(id),1),1), count(*)>0) from public.desk_log;"
], { cwd: "/home/ubuntu/services/lisa-cloud", stdio: "inherit" });
if (sequence.status !== 0) throw new Error(`sequence reset failed: ${sequence.status}`);
console.log(JSON.stringify({ imported_tables: tables.length, snapshot: manifest.createdAt }));
