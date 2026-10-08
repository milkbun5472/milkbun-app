// 连着两次保存同一键：前一笔回读读到后一笔，是被接替了，不是写坏了（片刻 2026-10-08 假模型冒烟抓到）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");

test("WAL 回读不一致时，本机已有更新的一版就让路，不报错也不拿旧值盖 IDB", () => {
  const blk = engine.slice(engine.indexOf("const SUPERSEDED = {};"), engine.indexOf('console.error("durable idbTxtPut failed:"'));
  assert.ok(blk.length > 50);
  assert.match(blk, /if \(_txtMirror\(\)\.get\(k\) !== s\) return SUPERSEDED; throw new Error\("WAL read-back mismatch"\)/);
  assert.match(blk, /if \(back === SUPERSEDED\) return;/);
  assert.ok(blk.indexOf("return SUPERSEDED") < blk.indexOf("idbTxtPut(k, s)"), "让路必须发生在写 IDB 之前");
});
