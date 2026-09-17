// 她 2026-09-16：「我让他换头像他说换了但是没用」。
//
// 换头像那一格有三道硬闸（v58.98 立的，注释里写着「规则降概率，代码才保证」）：
//   只认她刚发的真照片（最近 6 条内）· 冷却 7 天 · 主动轮不发。
// 三道闸防的是【TA 自作主张乱换】，**不是防她自己要**。可原来一视同仁：
// 她说「把头像换成这张」的时候，那张照片往往已经不在最近 6 条里了
// （发完照片又聊了几轮才想起来说），或者上次换还没满 7 天——
// 于是 avatar 那一格【压根没发下去】，而没有任何一句话告诉他"你现在换不了"，
// 他就顺口圆一句「换好了」。
//
// ⚠️判据是现成的，gaze.js 里一模一样的一句已经写过：
//   「预算防的是【代码偷偷花钱】，不是防她自己要」——手动那次不占自动额度。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };
const strip = t => t.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

// ── 「她开口要了没有」是公共那一份 ────────────────────────────
test("askedRecently 抽成公共的，记账那处也搬过去了", () => {
  const fi = app.indexOf("  const askedRecently = (history, re, turns) =>");
  const fj = app.indexOf("  const AVATAR_COOLDOWN_MS", fi);
  assert.ok(fi > 0 && fj > fi, "没有公共那一份");
  const askedRecently = new Function("return " + app.slice(fi, fj).replace("const askedRecently =", "").replace(/;\s*$/, ""))();
  const U = t => ({ role: "user", content: t });
  const A = t => ({ role: "assistant", content: t });
  // 数的是【她说过几轮】，他的回复不占额度
  assert.equal(askedRecently([U("换个头像吧"), A("好"), U("嗯"), A("嗯"), U("在吗")], /头像/, 4), true);
  // 出了窗口就不算——再宽等于常驻
  assert.equal(askedRecently([U("换个头像吧"), U("a"), U("b"), U("c"), U("d")], /头像/, 4), false);
  assert.equal(askedRecently([U("今天好累")], /头像/, 4), false);
  assert.equal(askedRecently([], /头像/, 4), false);
  // 搬完原地不许留第二份
  assert.ok(!/const _askedRecord = \(function \(\) \{/.test(app), "记账那处的手写判据还留在原地");
  assert.match(app, /const _askedRecord = askedRecently\(history, \//);
});

// ── 她开口要：两道闸都让路 ────────────────────────────────
const seg = strip(cut("      const _askAvatar = !opts.proactive", "      // Protocol v2：能力格式"));

test("她提了头像，就往前多找一段——不再卡死在最近 6 条", () => {
  assert.match(app, /const ASK_PHOTO_LOOKBACK = 40;/);
  assert.match(seg, /const _askPick = \(_askAvatar && !_seenMsg\) \? freshPhotoIn\(\(chatsRef\.current\[charId\] \|\| \[\]\)\.slice\(-ASK_PHOTO_LOOKBACK\)\) : null;/);
});

test("她开口要的时候，7 天冷却不算数", () => {
  assert.match(seg, /const _seenAvatarOk = !!\(_avatarMsg && \(avatarCoolOk\(charId\) \|\| _askAvatar\)\);/);
  // 她没开口那一半照旧受冷却管——闸没被拆掉，只是对她让路
  assert.match(app, /const avatarCoolOk = charId => \(Date\.now\(\) - Number\(\(avatarSwapRef\.current\[charId\] \|\| \{\}\)\.ts \|\| 0\)\) >= AVATAR_COOLDOWN_MS;/);
  assert.match(app, /const AVATAR_COOLDOWN_MS = 7 \* 86400000;/);
});

test("主动轮照旧不发：那种轮次TA没在看照片", () => {
  assert.match(seg, /const _askAvatar = !opts\.proactive && askedRecently\(history, \/头像\/, 4\);/);
  assert.match(seg, /const _seenMsg = opts\.proactive \? null : freshUserPhoto\(charId\);/);
});

test("她翻旧账要换头像时，不补记老照片的画面（note 只跟刚看见的那张走）", () => {
  assert.match(seg, /const seenHint = _seenMsg \? photoSeenHint\(_seenAvatarOk, uName\)/);
  assert.match(seg, /: \(_seenAvatarOk \? photoSeenAskHint\(uName\) : ""\);/);
  // 她开口那一档的字段里没有 note
  assert.ok(seg.indexOf('(_seenAvatarOk ? ",\\"photoSeen\\":{\\"avatar\\":false}" : "")') > 0,
    "她开口那一档的字段里不该有 note");
});

// ── 说了就得真填，填不了就照实说 ───────────────────────────
test("提示里把「说了没填＝没换」摆到台面上", () => {
  const hint = cut("  const photoSeenAskHint = uName =>", "  const photoSeenHint = (canAvatar, uName) =>");
  assert.match(hint, /填了 false 就等于没换/);
  assert.match(hint, /绝不许说「换好了」「已经换了」/);
  assert.match(hint, /说了却没填，她那边一点动静都不会有/);
  // ⚠️仍然是【问】不是【命令】：她说了他也可以不换，那是他这个人的事
  //（施工规则/bans-make-it-dumber：给出口，不给判决）
  assert.match(hint, /你也可以不换/);
  assert.match(hint, /在话里说清楚你不想换/);
});

test("一张真照片都没有时，明说做不到——回执是个承诺", () => {
  assert.match(seg, /if \(_askAvatar && !_avatarMsg\) \{/);
  const blk = cut('      if (_askAvatar && !_avatarMsg) {', '      // Protocol v2：能力格式');
  assert.match(blk, /\*\*这件事你现在做不到\*\*/);
  assert.match(blk, /别说已经换了、也别说等下换/);
  assert.match(blk, /让 " \+ uName \+ " 把照片发给你/);
});

// ── 落地那一头 ────────────────────────────────────────
test("换的是 _avatarMsg 那张，不是 _seenMsg", () => {
  // 她开口要那一档 _seenMsg 是 null，还传它的话整个落地会被 `if (!msg)` 挡掉，
  // 于是又变回「他说换了、实际没换」——这一条就是这次的病根本身
  assert.match(app, /if \(_avatarMsg && parsed\.photoSeen\) applyPhotoSeen\(charId, _avatarMsg, parsed\.photoSeen, _seenAvatarOk,/);
  assert.ok(!/applyPhotoSeen\(charId, _seenMsg,/.test(app), "还传着 _seenMsg");
  // applyPhotoSeen 自己那道门没动：canAvatar 为假、或没填 true，都不换
  assert.match(app, /if \(!canAvatar \|\| seen\.avatar !== true\) return;/);
  // 换完仍旧留住换之前那张，也仍旧不走 saveChar（那会把她踢到档案馆）
  assert.match(app, /const prev = ch\.avatarImage \|\| "";/);
  assert.match(app, /pC\(p => p\.map\(x => x\.id === charId \? \{ \.\.\.x, avatarImage: msg\.imageRef \} : x\)\);/);
});
