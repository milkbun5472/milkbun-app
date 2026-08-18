#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";

const source = process.argv[2];
if (!source) throw new Error("usage: import-auth-users.mjs <auth-users.jsonl.gz>");

const psql = spawn("sudo", [
  "docker", "compose", "exec", "-T", "db",
  "psql", "-v", "ON_ERROR_STOP=1", "-q", "-U", "postgres"
], { cwd: "/home/ubuntu/services/lisa-cloud", stdio: ["pipe", "inherit", "inherit"] });

const write = (s) => new Promise((resolve, reject) => {
  if (psql.stdin.write(s)) resolve();
  else psql.stdin.once("drain", resolve).once("error", reject);
});
const copyEscape = (s) => s.replaceAll("\\", "\\\\").replaceAll("\t", "\\t").replaceAll("\r", "\\r");

await write(`
begin;
create temp table lisa_auth_import(payload jsonb not null) on commit drop;
copy lisa_auth_import(payload) from stdin;
`);

let count = 0;
const lines = createInterface({ input: createReadStream(source).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  JSON.parse(line);
  await write(copyEscape(line) + "\n");
  count++;
}

await write(`\\.
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  confirmation_token,recovery_token,email_change_token_new,email_change,
  last_sign_in_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,
  created_at,updated_at,phone,phone_change,phone_change_token,
  email_change_token_current,reauthentication_token,is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  (payload->>'id')::uuid,
  coalesce(payload->>'aud','authenticated'),
  coalesce(payload->>'role','authenticated'),
  nullif(payload->>'email',''),
  '',
  nullif(payload->>'email_confirmed_at','')::timestamptz,
  '', '', '', '',
  nullif(payload->>'last_sign_in_at','')::timestamptz,
  coalesce(payload->'app_metadata','{}'::jsonb),
  coalesce(payload->'user_metadata','{}'::jsonb),
  false,
  nullif(payload->>'created_at','')::timestamptz,
  nullif(payload->>'updated_at','')::timestamptz,
  nullif(payload->>'phone',''),
  '', '', '', '',
  coalesce((payload->>'is_anonymous')::boolean,false)
from lisa_auth_import
on conflict (id) do update set
  email=excluded.email,
  email_confirmed_at=excluded.email_confirmed_at,
  raw_app_meta_data=excluded.raw_app_meta_data,
  raw_user_meta_data=excluded.raw_user_meta_data,
  updated_at=excluded.updated_at,
  encrypted_password=coalesce(auth.users.encrypted_password,''),
  confirmation_token=coalesce(auth.users.confirmation_token,''),
  recovery_token=coalesce(auth.users.recovery_token,''),
  email_change_token_new=coalesce(auth.users.email_change_token_new,''),
  email_change=coalesce(auth.users.email_change,''),
  phone_change=coalesce(auth.users.phone_change,''),
  phone_change_token=coalesce(auth.users.phone_change_token,''),
  email_change_token_current=coalesce(auth.users.email_change_token_current,''),
  reauthentication_token=coalesce(auth.users.reauthentication_token,'');

insert into auth.identities (
  provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id
)
select
  payload->>'id',
  (payload->>'id')::uuid,
  jsonb_build_object('sub',payload->>'id','email',payload->>'email','email_verified',true),
  'email',
  nullif(payload->>'last_sign_in_at','')::timestamptz,
  nullif(payload->>'created_at','')::timestamptz,
  nullif(payload->>'updated_at','')::timestamptz,
  gen_random_uuid()
from lisa_auth_import
where nullif(payload->>'email','') is not null
on conflict (provider_id, provider) do update set
  identity_data=excluded.identity_data,
  updated_at=excluded.updated_at;
commit;
`);
psql.stdin.end();

const exitCode = await new Promise((resolve, reject) => {
  psql.once("exit", resolve);
  psql.once("error", reject);
});
if (exitCode !== 0) throw new Error(`psql exited ${exitCode}`);
console.log(JSON.stringify({ imported_auth_users: count }));
