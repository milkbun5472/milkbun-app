const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");

// 她 2026-08-27 抓到：两个完全不同的角色隔三分钟各发一张自拍，都说了同一套——
// 「光线就这德行」「头发有点乱」「别挑刺」。批发得连措辞都快一样了。
test("那一族预先道歉要点名写出来，别只说「别用模板」", () => {
  const i = eng.indexOf("const PHOTO_NO_EXCUSE = ");
  assert.ok(i > 0, "禁令没了");
  const seg = eng.slice(i, eng.indexOf("`;", i));
  ["光线", "头发有点乱", "别挑刺", "别嫌弃", "凑合看"].forEach(w =>
    assert.ok(seg.includes(w), "得点名禁掉「" + w + "」这一句"));
});

test("光线该写在 scene 里，不该在气泡里再解释一遍", () => {
  const i = eng.indexOf("const PHOTO_NO_EXCUSE = ");
  const seg = eng.slice(i, eng.indexOf("`;", i));
  assert.match(seg, /那是 scene 的事/, "得说清光线归 scene 管");
  assert.match(seg, /气泡里不用再解释一遍/);
});

// 禁的是模板不是人：这个人特有的挑剔照旧写
test("留出口：这个人自己那种挑剔仍然可以写", () => {
  const i = eng.indexOf("const PHOTO_NO_EXCUSE = ");
  const seg = eng.slice(i, eng.indexOf("`;", i));
  assert.match(seg, /真要挑剔照片本身，得是【这个人特有的】/);
  assert.match(seg, /可以什么都不说只发图/, "得给「不解释」这个出口");
});

// 两处能发照片的界面都要吃到；线下没有 photo 能力，本来就不该有
test("单聊和群聊两处都拼上了，声明完没人用不算数", () => {
  assert.equal((app.match(/\+ PHOTO_NO_EXCUSE/g) || []).length, 2,
    "单聊 photoHint + 群聊 gSelfieHint，两处都要");
  const i = app.indexOf("const photoHint = canSelfie");
  assert.match(app.slice(i, i + 2600), /\+ PHOTO_NO_EXCUSE/, "单聊没接");
  const j = app.indexOf("const gSelfieHint = ");
  assert.match(app.slice(j, j + 2200), /\+ PHOTO_NO_EXCUSE/, "群聊没接");
});

test("没开自拍能力的角色一个字都不多发", () => {
  const i = app.indexOf("const photoHint = canSelfie");
  const seg = app.slice(i, i + 2700);
  assert.match(seg, /\n        : "";/, "canSelfie 为假时该是空串");
});

// 它和 STOCK_REPLY_BAN 是同一条判定的两个落点，别让人以为是两套道理
test("和「标准男友三件套」同一条判定：换个人也成立就不是你说的", () => {
  assert.match(eng, /把这条消息原样发给她手机里【另一个人】/, "老那条还在");
  const i = eng.indexOf("const PHOTO_NO_EXCUSE = ");
  assert.match(eng.slice(i, eng.indexOf("`;", i)), /原样发给她手机里另一个人也成立/, "新这条要挂到同一条判定上");
});
