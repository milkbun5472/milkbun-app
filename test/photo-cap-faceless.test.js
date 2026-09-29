// 没外貌/参考照的角色：露脸的不给，但不露脸的局部照要写进能力里（她 2026-09-29）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.resolve(__dirname, "../js/engine.js"), "utf8");
const body = src.slice(src.indexOf("function photoCapLine("), src.indexOf("\n}\n", src.indexOf("function photoCapLine(")) + 2);
const photoCapLine = new Function(body + "\nreturn photoCapLine;")();

test("没脸可锁：只给不露脸的 self 和空景", () => {
  const t = photoCapLine("她", { face: false });
  assert.match(t, /self（只限拍你身上看不见脸的一部分，face 必须填 false）/);
  assert.doesNotMatch(t, /self（自拍）|other（/);
  assert.match(t, /none（/);
});
test("有脸可锁：照旧给自拍和别人拍", () => {
  const t = photoCapLine("她", { face: true });
  assert.match(t, /self（自拍）/);
  assert.match(t, /other（别人给你拍的）/);
});
