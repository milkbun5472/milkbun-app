const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const cloud = fs.readFileSync(path.join(root, "js/cloud.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

test("日记生成先定义用户称呼，再用于声纹尾注", () => {
  const start = engine.indexOf("async function generateDiary");
  const end = engine.indexOf("\n}", start);
  const body = engine.slice(start, end);
  assert.ok(body.indexOf("const uName =") > 0);
  assert.ok(body.indexOf("const uName =") < body.indexOf("+ uName +"));
});

test("言秋亲笔草稿兼容正文型 payload，且空稿不认领", () => {
  const start = cloud.indexOf("async yanqiuDiaryDraftTake");
  const end = cloud.indexOf("async yanqiuMomentLike", start);
  const body = cloud.slice(start, end);
  assert.match(body, /src\.content/);
  assert.match(body, /src\.body/);
  assert.match(body, /src\.text/);
  assert.ok(body.indexOf("if (!paras.length) return null") < body.indexOf("claimed_at"));
});

test("权威备份导入不合并旧容器，并阻止旧云账本复活", () => {
  assert.doesNotMatch(app, /BackupMerge/);
  assert.match(app, /const importData = parsed\.data/);
  assert.match(app, /chat_ledger_authority_floor_v1/);
  assert.match(app, /chatMessagesAppRestoreRows\(restoreSince\)/);
});
