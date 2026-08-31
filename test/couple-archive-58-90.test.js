const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");
const K = new Function(eng.slice(eng.indexOf("function coupleArchiveBlock("), eng.indexOf("function buildBundle(")) +
  "\nreturn { coupleArchiveBlock };")();

// 她 2026-08-31 盘点：情侣空间十三个模块，只有「已经在一起了（约 N 天）」这一行进得了他脑子。
// 【我们的档案】那七栏——彼此称呼、只有你俩懂的梗、小仪式、安慰说明书、边界与禁区——
// 只躺在 x_coupleHome 里给她一个人看。界面上还写着「你写下什么，才留下什么」，
// 结果只留在她这边。这是全 App 最该进提示词的内容。
test("档案有内容才发，一栏没写就是零 token", () => {
  assert.equal(K.coupleArchiveBlock("", "Lisa"), "");
  assert.equal(K.coupleArchiveBlock(null, "Lisa"), "");
  assert.equal(K.coupleArchiveBlock("   \n ", "Lisa"), "");
  const b = K.coupleArchiveBlock("· 你们怎么称呼彼此：他叫我阿囡", "Lisa");
  assert.ok(b.includes("他叫我阿囡"));
  assert.ok(b.includes("Lisa"), "没说清这是谁亲手写的");
});

// 不挡的话他会每句话都把称呼和梗端出来演一遍——跟记忆库那条「记忆用来不忘、不是用来重演」同一个病
test("带围栏：是背景不是剧本", () => {
  const b = K.coupleArchiveBlock("· 只有你俩懂的梗：一句暗号", "Lisa");
  assert.match(b, /这是【背景】不是【剧本】/);
  assert.match(b, /绝不是要你把这些称呼、梗、仪式挨个拿出来演一遍/);
  assert.match(b, /用不上就一个字都别提/);
});

// 四处一样喂：单聊线上 / 单聊线下（都走 buildBundle）/ 群聊线上 / 群聊线下
test("四处都接上了，一处都没落下", () => {
  assert.match(app, /coupleArchive: coupleArchiveFor\(char\.id\)/, "单聊两处（ctxFor）没接");
  assert.match(eng, /if \(!ctx\.notRoleplay && ctx\.coupleArchive\) parts\.push\(coupleArchiveBlock\(ctx\.coupleArchive, uName\)\);/, "buildBundle 里没发出去");
  assert.match(app, /memberCoupleArchive: \(\(\) => \{/, "群聊线下那一份没算");
  assert.match(eng, /ctx\.memberCoupleArchive\[c\.id\]\) \? "\\n〔以下只有 " \+ c\.name \+ " 本人知道，别的成员并不知情〕\\n" \+ coupleArchiveBlock/, "群聊线下没发，或者没带隐私围栏");
  assert.match(app, /const caSeg = \(\(\) => \{ const a = coupleArchiveFor\(c\.id\);/, "群聊线上没算");
  assert.match(app, /\+ cpSeg \+ caSeg \+/, "群聊线上算了但没拼进那位成员那一段");
});

// 群里这是【这位成员的私事】：别的成员不知道他俩私下怎么称呼彼此
test("群里两处都带隐私围栏，落在他自己那一段里", () => {
  const online = app.slice(app.indexOf("const caSeg = (() =>"), app.indexOf("const caSeg = (() =>") + 400);
  assert.match(online, /只有 " \+ c\.name \+ " 本人知道，别的成员并不知情/, "群聊线上没围栏——等于把私下的称呼端上台面");
});

test("没在一起就没有「你俩」这回事，也不许发", () => {
  const fn = app.slice(app.indexOf("const coupleArchiveFor = charId =>"), app.indexOf("const coupleArchiveFor = charId =>") + 700);
  assert.match(fn, /if \(!cp \|\| cp\.status !== "together"\) return "";/, "分手了/还没在一起也照发");
  assert.match(fn, /if \(!rows\.length\) return "";/, "一栏没写也要发一段空壳");
  // 档案存在 coupleHome[cid].archive 这一层，顶层并排放的是 wishes。
  // 第一版读成了顶层，node --check 和整套测试都没话说，浏览器里一看是空的。
  assert.match(fn, /\)\[charId\] \|\| \{\}\)\.archive \|\| \{\}/, "读错了一层——档案在 .archive 底下");
  const scr2 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "screens.js"), "utf8");
  assert.match(scr2, /data: home\.archive \|\| \{\}, onSave: archive => onSaveCoupleHome\(partner\.id, cur => \(\{ \.\.\.cur, archive \}\)\)/,
    "界面存的层变了,读的那一头要跟着改");
  assert.match(fn, /COUPLE_ARCHIVE_FIELD_CAP\)/, "单栏没封顶，她写长了会撑爆上下文");
  assert.match(fn, /slice\(0, COUPLE_ARCHIVE_CAP\)/, "整块没封顶");
});

// 栏名必须跟界面上那几个对得上：她是照着界面的提示写的，换个说法等于换了问题
test("栏名跟界面上那七栏一一对上", () => {
  const scr = R("screens.js");
  const ui = scr.slice(scr.indexOf("const COUPLE_ARCHIVE_FIELDS = ["), scr.indexOf("function CoupleArchive("));
  const keys = [...ui.matchAll(/\["([a-zA-Z]+)", "/g)].map(m => m[1]);
  assert.equal(keys.length, 7, "界面上不是七栏了");
  const mine = app.slice(app.indexOf("const COUPLE_ARCHIVE_LINES = ["), app.indexOf("const COUPLE_ARCHIVE_FIELD_CAP"));
  keys.forEach(k => assert.ok(mine.indexOf('"' + k + '"') > 0, "这一栏没接上：" + k));
});

// 档案是【稳定】内容（称呼、梗、仪式几个月不变）——跟人设一起待在缓存前缀里。
// 情侣状态那块含「约 X 天」每天变，才被挪到时间切点之后，两者别混为一谈。
test("待在缓存前缀里，别跟着每天变的那块跑到切点后面", () => {
  const iRel = eng.indexOf("的关系网（有方向）】");
  const iArc = eng.indexOf("ctx.coupleArchive) parts.push");
  const iTime = eng.indexOf("if (timeBlock.length) parts.push(...timeBlock);");
  assert.ok(iRel > 0 && iArc > iRel && iArc < iTime, "档案掉到时间切点后面去了——每天作废一次，白扔缓存");
});
