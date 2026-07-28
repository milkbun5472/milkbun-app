import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const base = "http://127.0.0.1:18099";
const token = "test-only-token";
let child;

test.before(async () => {
  child = spawn(process.execPath, ["mock-server.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: { ...process.env, PORT: "18099", WATCH_TOKEN: token },
    stdio: "ignore",
  });
  await delay(150);
});

test.after(() => child?.kill());

test("rejects an unauthenticated watch", async () => {
  const response = await fetch(`${base}/watch/turn/nope`);
  assert.equal(response.status, 403);
});

test("queues idempotently and becomes ready without duplicate turns", async () => {
  const headers = {
    authorization: `Bearer ${token}`,
    "idempotency-key": "same-recording",
    "content-type": "multipart/form-data; boundary=test",
  };
  const first = await fetch(`${base}/watch/voice`, {
    method: "POST", headers, body: "--test--\r\n",
  }).then(r => r.json());
  const duplicate = await fetch(`${base}/watch/voice`, {
    method: "POST", headers, body: "--test--\r\n",
  }).then(r => r.json());
  assert.equal(first.turn_id, duplicate.turn_id);

  const pending = await fetch(`${base}/watch/turn/${first.turn_id}`, {
    headers: { authorization: `Bearer ${token}` },
  }).then(r => r.json());
  assert.equal(pending.status, "replying");

  const ready = await fetch(`${base}/watch/turn/${first.turn_id}`, {
    headers: { authorization: `Bearer ${token}` },
  }).then(r => r.json());
  assert.equal(ready.status, "ready");
  assert.match(ready.reply_text, /假后端回声/);
});

