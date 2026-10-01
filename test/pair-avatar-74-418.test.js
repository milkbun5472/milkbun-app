// 情头：她发一对，他挑一张自己用、另一张换到她那边（她 2026-10-02）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const grab = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };

test("找那一对：最近两张她发的真照片，先发的是第 1 张", () => {
  const src = grab("const freshPhotoPairIn = (", "const applyPairAvatar = (");
  const FRESH_PHOTO_LOOKBACK = 6;
  const fn = new Function("FRESH_PHOTO_LOOKBACK", src + "; return freshPhotoPairIn;")(FRESH_PHOTO_LOOKBACK);
  // 桩照着写进聊天记录的那一形状来：role/kind/imageRef（她发照片时 pChat 存的就是这几样）
  const rows = [
    { role: "user", kind: "photo", imageRef: "a", ts: 1 },
    { role: "assistant", content: "嗯" },
    { role: "user", kind: "photo", imageRef: "b", ts: 2 },
    { role: "user", kind: "photo", imageRef: "c", ts: 3 },
    { role: "user", content: "换情头" }
  ];
  assert.deepStrictEqual(fn(rows, 40).map(m => m.imageRef), ["b", "c"]);
  assert.equal(fn([{ role: "user", kind: "photo", imageRef: "x" }], 40), null, "只有一张不算一对");
});

test("他挑的那张给他、另一张给她，都只换这个聊天窗", () => {
  const src = grab("const applyPairAvatar = (", "  // 线下那一场里的");
  assert.match(src, /const his = pair\[k - 1\], hers = pair\[2 - k\];/);
  assert.match(src, /chatAvatar: his\.imageRef, myChatAvatar: hers\.imageRef/);
  assert.ok(!/avatarImage:/.test(src), "动到档案那张了");
});

test("只在她开口时给，而且换的能力真发下去了", () => {
  assert.match(app, /const _pairPick = \(!opts\.proactive && askedRecently\(history, PAIR_AVATAR_ASK_RE, 4\)\)/);
  assert.match(app, /if \(_pairPick\) \{\n\s*openCaps\.push\("pairAvatar"\);/);
  assert.match(app, /const _pairDone = !!\(_pairPick && parsed\.pairAvatar/);
});

test("单张换头像那三档提示都真发下去了（原来只有「刚发」那档）", () => {
  assert.match(app, /if \(seenHint\) \{\n\s*openCaps\.push\("photoSeen"\);\n\s*capState\.push\(seenHint\.trim\(\)\);/);
});
