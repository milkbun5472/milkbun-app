// 秋秋看得见某个角色想你想到哪儿了、还要多久、卡在哪（她 2026-11-04）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
test("app 出一份，速度跟动念同一个 LongingRate，卡在哪跟状态卡同一个 proactiveWhyNow", () => {
  const a = R("app.js");
  assert.match(a, /window\.__longingInfo = longingInfoFor;/);
  assert.match(a, /window\.LongingRate\.compute\(\{ charId: cid, lastMessage: last, temperament: dongnianTemperRef\.current\[cid\]/);
  assert.match(a, /卡在哪: proactiveWhyNow\(cid\)/);
});
test("秋秋的快照里，这会儿在说的那几个人带上思念", () => {
  assert.match(R("assistant.js"), /const li = window\.__longingInfo\(row\.id\); if \(li\) row\.思念 = li;/);
});
