// 写进手机没成要当场喊（她 2026-10-31：群友「正聊着天突然东西没了」，没云同步找不回）
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const eng = R("engine.js"), app = R("app.js");
test("txtWrite 两条写 IDB 的路，失败都要喊，不只记后台", () => {
  assert.match(eng, /console\.error\("durable idbTxtPut failed:", k, e\); txtWriteFailed\(k, e\);/);
  assert.match(eng, /console\.error\("idbTxtPut failed:", k, e\); txtWriteFailed\(k, e\);/);
  assert.match(eng, /window\.__saveFailed\(k, isQuotaError\(e\)\)/);
});
test("app 那头接住：说清是聊天没存进去、叫先导出，20 秒内只喊一次", () => {
  const blk = app.slice(app.indexOf("window.__saveFailed = (k, full) => {"), app.indexOf("window.__saveFailed = (k, full) => {") + 700);
  assert.match(blk, /storageWarnTs\.current < 20000/);
  assert.match(blk, /刚才的聊天/);
  assert.match(blk, /导出一份/);
});
