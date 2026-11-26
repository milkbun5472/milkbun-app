// 联机合照（她 2026-11-25「生图生他们几个」）：房里各家带来的角色一起拍一张；别人家的样子要现跟她那台要，她开着「允许拍照」才给
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const nsrc = read("js/netroom.js"), app = read("js/app.js");
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };

test("＋ 面板有「合照」一格", () => {
  assert.ok(/\["groupshot", "合照", "camera"\]/.test(nsrc));
});

test("别人来要样子：只给开着允许拍照、有参考照的；回的东西里没有人设", () => {
  const seg = cut(nsrc, 'e.t === "lookreq"', 'e.t === "look")');
  assert.ok(/c\.selfie/.test(seg), "没看允许拍照");
  assert.ok(/refPhoto/.test(seg));
  assert.ok(!/persona/.test(seg), "人设不能发出去");
});

test("拍：凑不够两个人不画；画好当我的照片发进房间", () => {
  const seg = cut(nsrc, "const shootGroup = async", "const sendCard = async");
  assert.ok(/cast\.length < 2/.test(seg));
  assert.ok(/sayRich\("photo"/.test(seg));
  assert.ok(/send\(\{ t: "lookreq"/.test(seg));
});

test("app 侧：lookOf 不带人设；drawCast 人人有参考照、走群合影那套", () => {
  const seg = cut(app, "lookOf: charId =>", "drawPhoto: async");
  assert.ok(!/persona/.test(seg));
  assert.ok(/kind: "group", cast: list/.test(seg));
  assert.ok(/filter\(x => x && x\.refPhoto\)/.test(seg));
});
