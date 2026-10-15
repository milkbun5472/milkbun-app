// 线下「Ta 帮我拍」那张卡头写成了「自拍」（她 2026-10-15 截图）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/components.js"), "utf8");
test("线下照片卡头：帮你拍的写「给你拍的」，不写自拍", () => {
  assert.ok(/m\.photoKind === "me" \? " · 给你拍的"/.test(src));
});
