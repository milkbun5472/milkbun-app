const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "chat_messages.sql"), "utf8");
const probe = fs.readFileSync(path.join(__dirname, "..", "supabase", "chat_messages_rls_test.sql"), "utf8");

test("共同聊天账本是逐行幂等、软删且强制 RLS", () => {
  assert.match(sql, /unique\s*\(user_id,\s*message_key\)/i);
  assert.match(sql, /deleted_at\s+timestamptz/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all on table public\.chat_messages from anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+delete/i);
});

test("App 只能修改正文、编辑戳、软删戳和小元数据", () => {
  assert.match(sql, /grant update\s*\(content, edited_at, deleted_at, metadata\)/i);
  assert.match(sql, /chat message provenance is immutable/i);
  assert.match(sql, /content edit requires a newer edited_at/i);
  assert.match(sql, /chat tombstone is immutable/i);
});

test("句段级性质筛元数据与回滚探针在位", () => {
  assert.match(sql, /metadata\s*\?\s*'excerpted'/i);
  assert.match(sql, /'life', 'emotion', 'decision', 'joke'/i);
  assert.match(probe, /on conflict \(user_id, message_key\) do nothing/i);
  assert.match(probe, /another user can read owner rows/i);
  assert.match(probe, /physical_delete_blocked/i);
  assert.match(probe, /rollback;/i);
});
