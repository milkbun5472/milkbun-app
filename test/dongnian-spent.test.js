// 想满了花在哪儿留一笔（她 2026-11-04：「刷新后直接思念退了不想我了」——走了愿望板／情侣空间那几个出口）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const a = R("app.js");
test("四个出口落地了都记一笔", () => {
  assert.match(a, /const dongnianSpent = \(cid, where\) =>/);
  ["线下那一场里自己动了一拍", "在愿望板上钉了一条心愿", "在情侣空间里给你留了一样东西", "在私聊里给你发了消息"].forEach(w => assert.ok(a.includes('dongnianSpent(cid, "' + w), w));
});
test("状态卡和秋秋都读它", () => {
  assert.match(R("components.js"), /"上一次想满：" \+/);
  assert.match(a, /上一次想满花在了哪儿: /);
});
