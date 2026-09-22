// 她 2026-09-22 转来一张截图：气泡里原样出现了
//   「（这一条是你此刻做的动作／你那边的动静，不是你发出去的消息）我收起伞站在宿舍楼门口…」
// ——那是我们【喂给模型看的旁注】，贴在它自己上一条正文的前面。
// 于是模型把它当成自己的行文习惯，下一轮照抄了一遍。
// ⚠️她自己那边没复现：这一条本来就看模型照不照抄，所以两头一起治——
//   记号改成一眼是元信息的形状，再在落进气泡之前兜一道。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const strip = (() => {
  const i = app.indexOf("  const ECHOED_META =");
  assert.ok(i > 0, "抠不出 ECHOED_META");
  const j = app.indexOf("\n", app.indexOf("const stripEchoedMeta", i));
  return new Function(app.slice(i, j) + "\nreturn stripEchoedMeta;")();
})();

test("照抄过来的旁注要摘掉，两种形状都认", () => {
  assert.equal(strip("（这一条是你此刻做的动作／你那边的动静，不是你发出去的消息）我收起伞站在雨棚下"), "我收起伞站在雨棚下");
  assert.equal(strip("【这一条是你此刻的动作／你那边的动静，不是你发出去的消息；这是旁注，别把它抄进你的正文】我脱下外套挂在椅背上"), "我脱下外套挂在椅背上");
  assert.equal(strip("（这条你是用语音说的）今天累不累"), "今天累不累");
});

test("别误伤真正的括号台词", () => {
  assert.equal(strip("（笑）今天累不累"), "（笑）今天累不累");
  assert.equal(strip("（把伞收起来）"), "（把伞收起来）");
  assert.equal(strip("我此刻做的动作是把外套挂上"), "我此刻做的动作是把外套挂上");
  assert.equal(strip(""), "");
  assert.equal(strip(null), "");
});

test("落进气泡之前真的过了这一道", () => {
  assert.match(app, /words = words\.map\(stripAiStamp\)\.map\(stripEchoedMeta\)\.filter\(Boolean\);/, "单聊那一路没接上");
  assert.match(app, /\.map\(stripAiStamp\)\.map\(stripEchoedMeta\)\.filter\(Boolean\)/, "群聊那一路没接上");
});

// ⚠️源头那一半：记号本身要长得像元信息，而不是像一句括号旁白
test("喂进去的记号改成了【】，并且自己说了别抄", () => {
  // v72.96：动作那一行整个搬去了旁白侧，assistant 这边只剩语音那条旁注。
  //   剥离器那一半照旧留着——老聊天记录里还躺着当年那句。
  assert.match(app, /【这条你是用语音说的；这是旁注，别把它抄进你的正文】/, "语音那条旁注没跟着改");
  assert.ok(!/const ac = stp \+ byU \+ \(\(m\.role === "narration"/.test(app), "动作行又被放回 assistant 那一侧了");
  assert.ok(!/"（这一条是你此刻做的动作／你那边的动静，不是你发出去的消息）"/.test(app), "旧的括号版还留着");
});
