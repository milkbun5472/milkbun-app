// 片刻、直播、朋友圈也按面具认人（她 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "../js/" + f), "utf8");
const A = R("app.js"), SH = R("shua.js"), LV = R("live.js");

test("片刻：大号跟面具走，只叫认得出的人来评；她去评别人，不认识这张面具的照陌生账号", () => {
  assert.match(SH, /const knows = c => !c \|\| onAlt \|\| onCp \|\| !props\.maskKeyOf \|\| props\.maskKeyOf\(c\.id\) === maskUse;/);
  assert.match(SH, /if \(maskUse\) v\.mask = maskUse;/);
  assert.match(SH, /characters\.filter\(c => \(!lead \|\| c\.id !== lead\.id\) && knows\(c\)\)/);
  assert.match(SH, /const asAlt = onAlt \? altName : \(c0 && !knows\(c0\) \? myName : ""\);/);
  assert.match(SH, /"data-wk": "shuamaskrow"/);
});

test("直播：自己的号＝TA 认识的那张面具；开播时跟她用别的面具的观众当陌生主播", () => {
  assert.match(LV, /const mn = props\.maskNameFor\(cfg\.charId\); if \(mn\) ses\.meName = mn;/);
  assert.match(LV, /watchInstruction\(ses, ses\.meName \|\| uName, first\)/);
  assert.match(LV, /\+ \(props\.maskNote \? props\.maskNote\(chars\) : ""\), HOST_SHAPE\)/);
});

test("朋友圈：谁刷得到照「谁可以看」，没挑就只有主面具那边的人", () => {
  assert.match(A, /const momSeen = \(m, charId\) => /);
  assert.equal((A.match(/const canSee = liveChars\.filter\(c => momSeen\(mom, c\.id\)\);/g) || []).length, 2);
  assert.match(A, /\(moments \|\| \[\]\)\.filter\(m => momSeen\(m, char\.id\)\)\.slice\(0, 3\)/);
});
