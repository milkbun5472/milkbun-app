// 群友 2026-09-30：「世界书那一栏关键词部分有全半角的要求吗？还是说都可以？」——现在都可以。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const i = src.indexOf("function loreKeywordHit("), j = src.indexOf("\nfunction selectLore(", i);
assert.ok(i > 0 && j > i, "抠不出 loreKeywordHit");
const hit = new Function(src.slice(i, j) + ";return loreKeywordHit;")();

test("全角半角不分：字母、数字、括号", () => {
  assert.equal(hit({ keyword: "ＡＢＣ" }, "hi abc"), true);
  assert.equal(hit({ keyword: "abc" }, "ＡＢＣ来了"), true);
  assert.equal(hit({ keyword: "１２３" }, "房号123"), true);
  assert.equal(hit({ keyword: "(小黑)" }, "我家（小黑）"), true);
});

test("分隔符：逗号（两种）、顿号、竖线（两种）都认", () => {
  ["猫,狗", "猫，狗", "猫、狗", "猫|狗", "猫｜狗"].forEach(kw => assert.equal(hit({ keyword: kw }, "一只狗"), true, kw));
});

test("没打中的还是没打中；正则模式不受影响", () => {
  assert.equal(hit({ keyword: "宵禁" }, "今天天气不错"), false);
  assert.equal(hit({ keyword: "a{2,}", regex: true }, "aaa"), true, "正则被按逗号切坏了");
});
