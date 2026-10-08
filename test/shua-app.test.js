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
  assert.match(S, /props\.probeAs\(c, charInstruction\(acc\.handle, sk, realFr \? \[\] : friends, acc, hotToday\(\), extra\) \+ \(toCp\[c\.id\]/);
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
  assert.match(S, /\{ by: "char", charId: c\.id, author: handle, skin: sk \}/);
});

test("请TA们发：拍好一条出一条，慢的那个不拖住整批；按不了时字色跟皮走", () => {
  assert.match(S, /Promise\.race\(\[props\.probeAs\(c, charInstruction\(acc\.handle, sk, realFr \? \[\] : friends, acc, hotToday\(\), extra\) \+ \(toCp\[c\.id\][^\n]*?, shapeChar\(sk, !realFr && friends\.length > 0, newAcc\)\)\.catch\(\(\) => null\), timeout\]\)/);
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
  assert.match(S, /ofSkin\.filter\(v => v\.by === "me" && !v\.cp && !!v\.alt === onAlt\)/);
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
  assert.match(S, /charInstruction\(acc\.handle, sk, realFr \? \[\] : friends, acc, hotToday\(\), extra\)/);
  assert.match(S, /props\.ask\(spotSystem\(/);
  assert.match(A, /const route = \(routePicked\(bgApiId\) && bgActive\) \? bgActive/);
});

test("456：TA的号一贯的样子、今日热门、合拍", () => {
  const A = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(S, /function charInstruction\(handle, skin, friends, acc, hot, extra\)/);
  assert.match(S, /hadAcc \? \{\} : \{ bio: S\(d\.bio\)/);
  assert.match(S, /page\.kind === "acct"/);
  assert.match(S, /const genHot = async \(\) =>/);
  assert.match(S, /const topicHit = v =>/);
  assert.match(S, /v\.withCharId && props\.drawDuo \? await props\.drawDuo/);
  assert.match(S, /withId: onAlt \? "" : withId/);
  assert.match(A, /drawDuo: async \(charId, desc\) =>/);
  assert.match(A, /worldHint: \(\) => String\(loreForContext\("social"/);
});

test("情侣号：只给在一起的人，你俩共用，TA也会发在上面", () => {
  const A = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(S, /const cpId = \/\^cp:\/\.test\(using\) && cps\[using\.slice\(3\)\] && togetherIds\.indexOf\(using\.slice\(3\)\) >= 0/);
  assert.match(S, /const mine = onCp \? ofSkin\.filter\(v => v\.cp === cpId\)/);
  assert.match(S, /toCp\[c\.id\] = cpHere/);
  assert.match(A, /togetherIds: \(\) => Object\.keys\(couplesRef\.current/);
});

test("v75.010 补欠账：直播那一格跟皮、熟人口气开关", () => {
  assert.match(S, /pal: skin === "b" \? \{ bg: B\.bg/);
  assert.match(S, /const realFr = !!\(dbRef\.current\.me && dbRef\.current\.me\.realFriends\);/);
  const L = fs.readFileSync(path.join(__dirname, "..", "js", "live.js"), "utf8");
  assert.match(L, /const t = props\.pal \? Object\.assign\(\{\}, t0, props\.pal, \{ __pal: true \}\) : t0;/);
  assert.match(L, /props\.charPay\(gc\.id, -g\.amount,/);
  const A = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const w = A.slice(A.indexOf("const genWeekSpend = async"), A.indexOf("const catchUpWallet = async"));
  assert.match(w, /card: _kinDay && b && b\.card === true/);
});

test("两套皮只说事实不给内容；扔掉要先问；收藏的不会被挤掉", () => {
  assert.match(S, /const V_FACT = "/);
  assert.match(S, /const B_FACT = "/);
  ["BGM", "bgm", "挑战", "同款", "教程", "vlog", "测评", "盘点"].forEach(w => {
    const facts = S.slice(S.indexOf("const V_FACT"), S.indexOf("const B_EXTRA"));
    assert.ok(facts.indexOf(w) < 0, "事实那两句里出现了内容示范：" + w);
  });
  assert.match(S, /const capVideos = vs => \{ let left = CAP; return arr\(vs\)\.filter\(v => v\.faved \|\| v\.by === "me" \|\| \(left-- > 0\)\); \};/);
  assert.match(S, /props\.confirm\("扔掉这条视频？"/);
  assert.match(S, /page\.kind === "favs"/);
});

test("23：横着看的系列/投币/充电/弹幕/楼中楼，竖着刷的同款/同城", () => {
  assert.match(S, /function BDetail\(\{ v, charOf, busy, onBack, onLike, onFave, onDraw, drawing, onSend, onShare, onAuthor, onDel, coinsLeft, onCoin, onCharge, onDm, onReply \}\)/);
  assert.match(S, /const SERIES_ADD = ',"series":""';/);
  assert.match(S, /if \(\(v\.myCoins \|\| 0\) >= 2\) \{ toast\("一条最多投两枚"\)/);
  assert.match(S, /props\.charPay\(c\.id, Math\.floor\(amt \* \(1 - CHARGE_CUT\)\), "片刻收到充电/);
  assert.match(S, /const CHARGE_CUT = 0\.25;/, "充电作者到手 75%");
  assert.match(S, /const heard = mineB\.slice\(0, 3\)\.flatMap/);
  assert.match(S, /function threadInstruction\(/);
  assert.match(S, /onSame: v\.by !== "me" \? \(\) => setPage\(\{ kind: "post", same: v \}\) : null/);
  assert.match(S, /const genNpc = async city =>/);
  // 刷新页的「刷几条路人的」在同城那一格刷的是这座城（v75.043），别处还是推荐
  assert.match(S, /onNpc: \(\) => genNpc\(feed === "city" && cities\.length \? cityNow : ""\)/);
});

test("关注和推荐不重样；底栏收藏格带文件夹；消息挪进「我」", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../js/shua.js"), "utf8");
  assert.match(src, /feed === "rec" \? v\.by !== "char" : v\.by === "char"/);
  assert.match(src, /tabBtn\("fav", "收藏"\)/);
  assert.doesNotMatch(src, /tabBtn\("msg"/);
  assert.match(src, /tab === "fav"/);
  assert.match(src, /folders: arr\(dbRef\.current\.folders\)\.concat/);
  assert.match(src, /onClick: \(\) => setTab\("msg"\)/);
});

test("播放页一排五个带图标，扔掉和画出来进「⋯」；收藏长按挑文件夹，不用系统下拉框", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../js/shua.js"), "utf8");
  const bd = src.slice(src.indexOf("function BDetail"), src.indexOf("function ShuaApp") > 0 ? src.indexOf("function ShuaApp") : undefined);
  assert.match(src, /const icon = \(k, c, size, on\)/);
  assert.match(bd, /"aria-label": "更多"/);
  assert.doesNotMatch(bd, /act\("扔掉"/);
  assert.doesNotMatch(src, /h\("select"/);
  assert.match(src, /setPicking\(v\.id\)/);
  assert.match(src, /WebkitLineClamp: 3/);
});

test("片刻／直播多人那一段走群聊公共的人设拼法，不另起一套", () => {
  const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  const blk = app.slice(app.indexOf("briefFor: (c, _i, all)"), app.indexOf("pay: (delta, label) => changeWallet"));
  assert.ok(blk.length > 50);
  assert.match(blk, /groupPersonaText\(c\.persona, groupPersonaBudget\(/);
  assert.match(blk, /groupNowSegs\(c, /);
  assert.doesNotMatch(blk, /persona \|\| ""\)\.slice\(0, 2500\)/);
});

test("收藏夹那一排是文件夹，不是药丸", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../js/shua.js"), "utf8");
  assert.match(src, /function FolderTab\(/);
  const fav = src.slice(src.indexOf('tab === "fav"'), src.indexOf('tab === "msg"'));
  assert.doesNotMatch(fav, /borderRadius: 999/);
  assert.match(fav, /h\(FolderTab, \{ key: f\.id, small: true/);
});

test("文案说清楚是作者配的那段话，竖着刷底下一定露出来", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../js/shua.js"), "utf8");
  assert.match(src, /const CAPTION_FACT = /);
  assert.equal((src.match(/文案 caption（" \+ CAPTION_FACT|caption 文案（" \+ CAPTION_FACT/g) || []).length, 2, "TA 发和路人发两处都要讲清");
  assert.match(src, /\(v\.caption \|\| arr\(v\.tags\)\.length\) \?/);
});

test("同城算上架空世界；刷新在同城就刷这座城；带今天日期；右边那排压矮；分享一排四个", () => {
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "../js/shua.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /const shuaCities = \(\) =>/);
  assert.match(app, /K\.charRealm\(c, worldsRef\.current/);
  assert.match(app, /cityNote: name =>/);
  assert.doesNotMatch(src, /"刷几条这座城的"/);
  assert.match(src, /feed === "city" && cities\.length \? genNpc\(cityNow\)/);
  assert.equal((src.match(/DATE_FACT\(\)/g) || []).length, 2);
  assert.match(src, /repeat\(4, minmax\(0, 1fr\)\)/);
  const pane = src.slice(src.indexOf("function VideoPane"), src.indexOf("function CommentsPage"));
  assert.match(pane, /"aria-label": "更多"/);
  assert.match(pane, /textAlign: "center"/);
});

test("聊天里的视频卡画面铺满卡宽", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../js/shua.js"), "utf8");
  const card = src.slice(src.indexOf("function ShuaShareCard"), src.indexOf("window.ShuaShareCard"));
  assert.doesNotMatch(card, /aspectRatio/);
  assert.match(card, /width: "100%", height: v\.skin === "b"/);
});

test("同城那排限宽能横滑；在同城打开刷新页，刷路人刷的是这座城", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../js/shua.js"), "utf8");
  assert.match(src, /maxWidth: "calc\(100% - 120px\)", minWidth: 0/);
  assert.match(src, /overflowX: "auto", maxWidth: "100%", padding: "4px 12px 6px", whiteSpace: "nowrap", touchAction: "pan-x"/);
  assert.match(src, /onNpc: \(\) => genNpc\(feed === "city" && cities\.length \? cityNow : ""\)/);
});
