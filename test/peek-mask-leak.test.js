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
test("翻手机录像里的朋友圈也按面具滤：别的面具的人、她别的面具发的、留下那帖底下他们的赞和评论都不在", () => {
  const fs = require("fs"), src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  const a = src.indexOf("function peekMomentsView"), b = src.indexOf("function MomentsFeed");
  const win = {};
  const f = new Function("window", src.slice(a, b) + "return peekMomentsView;")(win);
  const list = [
    { id: 1, characterId: "a", likers: ["小乙"], comments: [{ author: "小乙", text: "x" }, { author: "小甲", text: "y" }] },
    { id: 2, characterId: "b" }, { id: 3, mine: true, mask: "" }, { id: 4, mine: true, mask: "m2" }];
  assert.equal(f(list), list, "没在翻手机时原样");
  win.__peekHide = new Set(["b"]); win.__peekMask = { ids: new Set(["b"]), names: ["小乙"], mine: "" };
  const out = f(list);
  assert.deepEqual(out.map(m => m.id), [1, 3]);
  assert.deepEqual(out[0].likers, []); assert.deepEqual(out[0].comments.map(c => c.author), ["小甲"]);
  const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(src, /moments: peekMomentsView\(moments\),/);
  assert.match(app, /filter\(x => x && !maskNames\.includes\(x\)\)/);
  assert.match(app, /window\.__peekMask = Object\.assign\(peekMaskInfo\(mo\), \{ mine: maskKeyOf\(charId\) \}\)/);
});
test("上次翻过的记录也照这次的面具和藏人滤；朋友圈互动消息那条也走同一份", () => {
  const fs = require("fs"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(app, /gone = peekMaskInfo\(maskIds\.concat\(\[\.\.\.userHide\]\)\)\.names/);
  assert.match(app, /const who = \(L\.who \|\| \[\]\)\.filter\(ok\), taps = \(L\.taps \|\| \[\]\)\.filter\(ok\), th = \(L\.thoughts \|\| \[\]\)\.filter\(ok\)/);
  assert.ok(!/L\.who\.join/.test(app), "不许再把上回的人名原样摆回去");
  assert.match(cmp, /const momNews = \(peekMomentsView\(moments\) \|\| \[\]\)/);
});
