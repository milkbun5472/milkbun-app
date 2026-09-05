// v63.06 她 2026-09-05：「真心话大冒险里面还是有瓶子emoji，把它也改了吧」。
// 酒瓶 emoji 全部退场，换成程序画的俯视玻璃瓶（TDBottle）：错误/加载两个大图、
// 转动动画（CSS 旋转）各一只；公告、指向日志、转瓶按钮改纯文字。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");

test("瓶子是画出来的，不是 emoji", () => {
  assert.ok(src.indexOf("\u{1F37E}") < 0, "酒瓶 emoji 还在");
  const bottle = src.slice(src.indexOf("function TDBottle"), src.indexOf("function TruthDareGame"));
  assert.match(bottle, /viewBox: "0 0 64 64"/, "瓶子不是 svg 了");
  assert.match(bottle, /props\.spin \? \{ animation: "tdspin/, "转起来那口没了");
  // 三处都用它：错误屏、加载屏、转动动画（转动那只带 spin）
  assert.equal((src.match(/h\(TDBottle, \{ size: 52 \}\)/g) || []).length, 2, "错误/加载屏不是画的瓶");
  assert.match(src, /h\(TDBottle, \{ size: 44, spin: true \}\)/, "转动动画不是画的瓶");
  assert.match(src, /@keyframes tdspin\{to\{transform:rotate\(360deg\)\}\}/, "旋转的 keyframes 没了");
  // 按钮回归纯文字
  assert.match(src, /spun \? "转下一轮" : "转瓶子"/, "按钮上还挂着别的东西");
});
