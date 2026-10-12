// 如果馆合照的说明停在半句（她 2026-10-13）：拍的时候按句末截，显示旧照片时也退回最后一个句末
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const i = eng.indexOf("function clipAtSentence");
const clipAtSentence = new Function(eng.slice(i, eng.indexOf("function bilingualKey", i)) + "; return clipAtSentence;")();
test("断在半句的退回最后一个句末", () => {
  assert.equal(clipAtSentence("他侧过身看着你。今天不准逗我多说话。屏幕上的数"), "他侧过身看着你。今天不准逗我多说话。");
});
test("超长按 n 截再退到句末；整段没句末的原样留", () => {
  assert.equal(clipAtSentence("一二三四五六七八。九十一二三四五六七八九十", 12), "一二三四五六七八。");
  assert.equal(clipAtSentence("没有句号的一段话很长"), "没有句号的一段话很长");
});
test("拍照和显示两处都用它", () => {
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const scr = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");
  assert.match(app, /"。此刻：" \+ clipAtSentence\(last, 200\)/);
  assert.match(scr, /clipAtSentence\(big\.scene \|\| ""\)/);
});
