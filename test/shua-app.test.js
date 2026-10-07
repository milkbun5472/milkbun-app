// 刷刷（她 2026-10-07：「整体做抖音界面，直播做其中一个板块」「跟论坛一样分两个按钮，可以选刷谁的」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const S = R("js/shua.js"), A = R("js/app.js");
test("名字只写在一处，不叫抖音", () => {
  assert.match(S, /const APP_NAME = "片刻";/);
  assert.ok(!/抖音/.test(S.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n")), "代码里（注释以外）出现了抖音");
});
test("刷新两颗：路人一批 / 挑人请TA们发", () => {
  assert.match(S, /function RefreshPage\(/);
  assert.match(S, /"刷几条路人的"/);
  assert.match(S, /"请TA们发"/);
  assert.match(S, /const genChars = async ids =>/);
  assert.match(S, /props\.probeAs\(c, charInstruction\(acc\.handle, sk, friends\), shapeChar\(sk, friends\.length > 0\)\)/);
});
test("直播是底栏一格，生图要点了才画", () => {
  assert.match(S, /tabBtn\("live", "直播"\)/);
  assert.match(S, /h\(window\.LiveApp, Object\.assign\(\{\}, props\.live/);
  assert.match(A, /draw: \(charId, desc, who\) => drawFromDesc\(/);
  assert.match(S, /onDraw: props\.canDraw \? \(\) => draw\(v\) : null/);
});

test("两套皮：竖着刷 / 横着看，两套视频各刷各的", () => {
  assert.match(S, /const vidSkin = v => v && v\.skin === "b" \? "b" : "v";/);
  assert.match(S, /const ofSkin = arr\(db\.videos\)\.filter\(v => vidSkin\(v\) === skin\);/);
  assert.match(S, /\[\["v", "竖着刷"\], \["b", "横着看"\]\]/);
  assert.match(S, /function BCard\(/);
  assert.match(S, /function BDetail\(/);
  assert.match(S, /mkVideo\(d, \{ by: "char", charId: c\.id, author: handle, skin: sk \}\)/);
});

test("请TA们发：拍好一条出一条，慢的那个不拖住整批；按不了时字色跟皮走", () => {
  assert.match(S, /Promise\.race\(\[props\.probeAs\(c, charInstruction\(acc\.handle, sk, friends\), shapeChar\(sk, friends\.length > 0\)\)\.catch\(\(\) => null\), timeout\]\)/);
  assert.match(S, /color: dis \? P\.ink : "#fff"/);
});

test("点进评论再回来还在原地，不回第一条", () => {
  assert.match(S, /const posKey = /);
  assert.match(S, /ref: el => \{ feedRef\.current = el; keepPos\(el, paneH\); \}/);
  assert.match(S, /ref: el => keepPos\(el, 0\)/);
});

test("小号：TA只当陌生人；小号发的不叫熟人；作品各列各的", () => {
  assert.match(S, /const onAlt = !!\(altName && db\.me && db\.me\.using === "alt"\);/);
  assert.match(S, /底下一个你不认识的账号「" \+ alt \+ "」评论了你/);
  assert.match(S, /if \(onAlt\) \{ spotAlt\(v, altName\); return; \}   \/\/ 小号发的/);
  assert.match(S, /const mine = ofSkin\.filter\(v => v\.by === "me" && !!v\.alt === onAlt\);/);
});

test("分享进聊天 + TA甩来 + 刷到彼此", () => {
  const C = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  const A = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(C, /if \(kind === "shuashare"\) return window\.ShuaShareCard \|\| null;/);
  assert.match(A, /kind: "shuashare", shua: snap, content: K\.shareText\(snap, c\.id, ""\)/);
  assert.match(A, /openCaps\.push\("shuaShare"\)/);
  assert.match(A, /parsed\.shuaShare = null;/);
  assert.match(S, /if \(onAlt\) \{ spotAlt\(v, altName\); return; \}/);
  assert.match(S, /她不知道你认出来了/);
  // v75.007 省钱：熟人来评并进TA自己那一枪；小号被刷到一枪写完；旁支走后台线路
  assert.match(S, /charInstruction\(acc\.handle, sk, friends\)/);
  assert.match(S, /props\.ask\(spotSystem\(/);
  assert.match(A, /const route = \(routePicked\(bgApiId\) && bgActive\) \? bgActive/);
});
