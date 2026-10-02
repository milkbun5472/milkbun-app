// 主动消息卡在哪一道（她 2026-10-02：「为啥还是不说话」）：每道闸都留一句人话，「TA 是什么脾气」条子下面读
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const a = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("每道闸都记下原因", () => {
  assert.match(a, /const pWhy = \(cid, why\) =>/);
  ["「允许 Ta 主动发消息」关着", "你们此刻在一起", "你正在输入框里打字", "离你们上次说话还不满", "TA 在睡觉", "TA 还端着", "25 分钟内刚试过一次", "刚试着发了一次但没发成"].forEach(k => assert.ok(a.includes(k), k));
});
test("条子下面写出来", () => {
  assert.match(c, /const proactiveWhyLine = \(\) =>/);
  assert.match(c, /"现在卡在："/);
});
test("打开页面当场查一遍，不等后台那一轮", () => {
  assert.match(a, /const proactiveWhyNow = cid =>/);
  assert.match(a, /window\.__proactiveWhyNow = proactiveWhyNow;/);
  assert.match(c, /window\.__proactiveWhyNow \? window\.__proactiveWhyNow\(character\.id\)/);
});
