// 每次发版都要写进秋秋攻略（她 2026-09-30）。
// bump-version 把 APP_VERSION 往上一推，这里就红，直到发版的人去 assistant-manual.js
// 把 STAMP 改成这一版：写上改了哪几条攻略，或者老实写一句为什么这一版不用改。
const assert = require("node:assert");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

test("秋秋攻略的 STAMP 跟上了这一版", () => {
  const app = read("app.js").match(/APP_VERSION\s*=\s*"(v[\d.]+)"/);
  assert.ok(app, "找不到 APP_VERSION");
  const w = {};
  new Function("window", read("assistant-manual.js"))(w);
  const M = w.AssistantManual;
  assert.ok(M && M.stamp, "assistant-manual.js 缺 STAMP");
  const s = M.stamp;
  assert.strictEqual(s.v, app[1],
    "发了 " + app[1] + " 但攻略还停在 " + s.v + "：去 js/assistant-manual.js 的 STAMP，" +
    "写上这一版改了哪几条攻略（entries 填 id），她用起来没变化就在 none 写一句为什么");
  const ids = s.entries || [];
  if (ids.length) {
    ids.forEach(id => assert.ok(M.byId(id), "STAMP.entries 里的「" + id + "」不是攻略里的词条 id"));
  } else {
    assert.ok(String(s.none || "").trim().length >= 6, "entries 为空时 none 必须写清为什么这一版不用改攻略");
  }
});
