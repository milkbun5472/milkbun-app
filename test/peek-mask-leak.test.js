// 查手机：别的面具不给看，却从「发过的图」读到名字、录像里点进了那人的聊天（群友 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("发过的图只算看得见的人；录像点到藏起来的人不打开；回放也挡", () => {
  const pics = A.slice(A.indexOf('if (on("pics")) {'), A.indexOf('if (on("pics")) {') + 600);
  assert.match(pics, /filter\(c => c\.id === viewerId \|\| shownId\(c\.id\)\)/);
  const open = A.slice(A.indexOf("const peekOpen = "), A.indexOf("const peekBack = "));
  assert.match(open, /window\.__peekHide/);
  assert.match(open, /&& ok\(x\.id\)/);
  assert.match(A, /if \(how === "replay"\) \{ try \{ const mo = peekMaskOthers\(charId\); window\.__peekHide = new Set\(mo\.map\(String\)\)/);
});

test("其他几样也照面具挡：论坛评论、一起听、备忘录、手记；录像里钱包购物外卖也滤", () => {
  const m = A.slice(A.indexOf("const peekPhoneMaterial = "), A.indexOf("const PEEK_APPS = "));
  assert.match(m, /filter\(f => f && !maskTrace\(f\.authorName\)/);
  assert.match(m, /p\.authorType === "me" && !maskTrace\(p\.title\)/);
  assert.match(m, /who = id => !id \|\| maskSet\.has\(String\(id\)\)/);
  assert.match(m, /\(d\.notes \|\| \[\]\)\.filter\(n => !maskTrace/);
  assert.match(m, /\["__me"\] \|\| \[\]\)\.filter\(e => e && !maskTrace/);
  assert.match(A, /log: peekMaskView\(\) \? walletLog\.filter/);
  assert.match(A, /log: peekMaskView\(\) \? takeoutLog\.filter/);
  assert.match(A, /window\.__peekHide = null; window\.__peekMask = null;/);
});
