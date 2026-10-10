// 群里 2026-10-10：钱包流水能删能清空；秋秋改动卡撤回后能重新应用、能复制
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), s = src("screens.js"), q = src("assistant.js");
test("钱包：删一笔、清空全部，只删记录不动余额", () => {
  assert.match(s, /"data-wk": "walletdel"/);
  assert.match(s, /"data-wk": "walletclear"/);
  const i = a.indexOf("onDelLog: ids =>"), seg = a.slice(i, i + 400);
  assert.match(seg, /saveJSON\("x_walletLog", n\)/);
  assert.ok(!/setWallet\(|x_wallet"/.test(seg), "删流水不许碰余额");
});
test("秋秋改动卡：撤回后有「重新应用」，每张卡能复制", () => {
  assert.match(q, /"data-part": "reapply"/);
  assert.match(q, /state === "已撤回" \|\| \/\^没应用\/\.test\(state\)/);
  assert.match(q, /"data-part": "copy"/);
});
