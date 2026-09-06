const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), scr = R("screens.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
const nocomment = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const rec = grab(app, "  const genCoupleRecall = async char => {", "  const readCoupleRecall = id =>");
// ⚠️右边界用它自己的收尾。拿隔壁那个函数当锚，隔壁一插新代码（v58.98 的抽屉/看照片
// 那几件就插在中间）就会把别人的 setTimeout 算到它头上。
const _lvi = app.indexOf("  const leaveInCoupleSpace = async (char, styleHint, manual) => {");
const leave = app.slice(_lvi, app.indexOf("\n  };", _lvi) + 4);

// ── c 同一件事的两个版本 ──────────────────────────────────────────────────
test("挑的是你俩【都在场】的事，问过的不再问第二遍", () => {
  // v59.33：判据换成全 App 那一条 memShareChar。原来直接 .includes(char.id)，
  // 把【charIds 为空＝旧全局记忆】全挡在门外（见 js/app.js:45 那条注释），
  // 于是库里有东西这一页也一直挑不出事。要挡的是「归别人的记忆」，不是「旧记忆」。
  assert.match(rec, /memShareChar\(\[char\.id\], m\.charIds\)/, "挑到了跟他无关的事");
  assert.match(rec, /const told = new Set\(\(coupleRecallRef\.current \|\| \[\]\)[\s\S]{0,120}\.map\(x => x\.memId\)\)/, "没记住问过哪些");
  assert.match(rec, /!told\.has\(m\.id\)/, "会重复问同一件事");
  assert.match(rec, /if \(!pool\.length\) \{ toast\(told\.size \? "你们经历过的都问过一遍了"/, "没料的时候和问完了的时候，话该不一样");
});

test("要的是【落差】，不是让他复述一遍她写的", () => {
  assert.match(rec, /你留意到的、和她写下来的，多半不是同一处/, "没说清这一页要的是什么");
  assert.match(rec, /就照你记的写，别去迁就她那一版——两版不一样才是这一页的意思/, "没挡住他顺着她那版复述");
  assert.match(rec, /schemaHint: "\{\\"his\\":[\s\S]{0,90}\\"note\\"/, "没让他点出哪儿不一样");
  // 这一枪【该】带她那一版：他要对着她记的写他记的，跟问答小本封存是两回事，别混
  assert.match(rec, /【她记下的】" \+ String\(pick\.text\)/, "不给他看她那版,就没有「两个版本」可言了");
  const ui = grab(scr, "function CoupleRecall({", "// 情侣空间·我们说好的");
  assert.match(ui, /"你记下的"/); assert.match(ui, /partner\.name \+ " 记得的"/);
  assert.ok(!/h\(Sheet/.test(ui), "用了半窗——见 施工规则/no-half-sheet.md");
});

// ── b 他趁你不在动过这里 ──────────────────────────────────────────────────
// ⚠️这一条的全部意义在于【不多花钱】：App 里本来就有「思念出口」，这里只是多一个出口。
test("不新开定时器、不多花一次调用——只是把思念的出口换了一个", () => {
  // v62.34：泄压挪到出口落地之后，所以这一行多了个 _drain()；签名也多了 manual 那一档
  const fire = grab(app, "          if (activeOffScene) { offlineReply(cid); _drain(); }", "          return; // 一次一个，错峰");
  // v61.35：那个 0.3 收成了模块级常量 COUPLE_LEAVE_P（现在是 0.45，她 2026-09-03 定的）
  assert.match(fire, /else if \(_cpNow && Math\.random\(\) < COUPLE_LEAVE_P\)\n *leaveInCoupleSpace\(c, jwStyle\)\.then\(_settle\);/,
    "没接在思念那条现成的链上,或者不是 else 分支（那就是多花一次）");
  // v62.34：最后那一档包了个大括号（要在里面 _drain）；判据不变——发消息必须是【else】，
  // 排在留东西后面，不能跟它并列执行，否则一次动念烧两次调用。
  assert.ok(fire.indexOf("else { replyNow(cid") > fire.indexOf("leaveInCoupleSpace"), "留东西和发消息不是二选一——那就变成两次了");
  // 愿望那一档也得是同一条 if/else 上的一环（v62.34），不是另起一条链
  assert.ok(fire.indexOf("pinWishAsChar") > 0 && fire.indexOf("pinWishAsChar") < fire.indexOf("leaveInCoupleSpace"),
    "钉愿望那一档没排进这条 else 链里——那就是多花一次");
  // 只对正式在一起的那位；三成，天天留就成了另一种刷屏
  // _cpNow 算在这一段【上面】（愿望和留东西两档共用它），所以对着整份 app 判
  assert.match(app, /const _cpNow = \(\(couplesRef\.current \|\| \{\}\)\[cid\] \|\| \{\}\)\.status === "together";/, "没在一起的也往情侣空间里塞");
  assert.match(fire, /_cpNow && Math\.random\(\) < COUPLE_LEAVE_P/, "留东西那一档没卡「在一起」");
  assert.match(fire, /Math\.random\(\) < COUPLE_LEAVE_P/, "概率没有卡住");
  assert.match(app, /^const COUPLE_LEAVE_P = 0\.\d+;$/m, "概率没有一个能改的常量");
  assert.ok(!/setInterval|setTimeout/.test(nocomment(leave)), "自己又开了一条定时器");
});

test("留下的东西落进的是【已经会渲染它】的那两个地方", () => {
  // v59.23：便签墙撤了，他留下的那一路改落抽屉（抽屉本来就认 kind + openedTs）；
  // 时光轴那一路不变，本来就认 byCharacter。
  // v61.35：where 的第三档 note（便签墙）删了——那面墙 v59.23 就撤掉了，
  // 它的产物却被当成悄悄话塞进抽屉，等于三个出口里两个通向同一样东西。
  // 现在认不出 where 的一律当 drawer 落，所以这里改盯【落进抽屉】这件事本身。
  assert.match(leave, /kind: "word",[\s\S]{0,300}saveJSON\("x_coupleDrawer", n\)/, "他留的那一张没落进抽屉");
  assert.match(scr, /whisper: \{ zh: "一句悄悄话"/, "抽屉不认这一类，渲染出来是「他捡到的」");
  assert.match(leave, /byCharacter: true, unread: true/, "时光轴那条没标成他写的");
  assert.match(scr, /ev\.byCharacter \?/, "时光轴不认 byCharacter 了");
  assert.match(leave, /saveJSON\("x_coupleTimeline", n\)/);
  // 入库只写一处：v59.23 之前同样的代码在四个地方各写了一遍
  const app2 = R("app.js");
  assert.match(app2, /const drawerWhisper = \(charId, text\) => \{/, "没收成一处");
  // ⚠️别冻在【一共几处】这个数上：一次性搬家每加一段，这个数就变一次，
  //（v59.34 加了 x_whispers→抽屉那一段，它就从 2 变成 3），可要证的东西没变过。
  // 要证的是【活着的写手只有一个】：开机那几段一次性搬家不算写手，把它们摘掉再数。
  const bootMig = app2.slice(app2.indexOf('const _oldW = loadJSON("x_whispers"'),
    app2.indexOf('setCoupleDrawer(loadJSON("x_coupleDrawer", []))'));
  assert.ok(bootMig.length > 200, "抠不出开机那几段一次性搬家");
  const live = app2.replace(bootMig, "");
  assert.equal((live.match(/kind: "whisper"/g) || []).length, 1, "悄悄话入库又散开写了，就该只有 drawerWhisper 一处");
  // 她不在场，所以不该写成给她的留言模板
  assert.match(leave, /她不在场，所以不用问她好、不用等她回/, "会写成一条对着她说的留言");
  assert.match(leave, /等她自己发现/, "没说清这件事的意思是「回来才发现」");
  assert.match(leave, /catch \(e\) \{ console\.warn\("\[couple leave\]"/, "失败会把那一轮思念整个炸掉");
});

test("入口和红点都在，不是写了没人能点到", () => {
  assert.match(scr, /sub === "recall"/, "没有分发");
  // ⚠️别冻在某个壳函数的名字上：v59.21 撤了 emoji、v59.24 连 tile() 这个壳都换了。
  // 要证的是【有一个能进这一页的入口】，那就直接找那个入口。
  assert.match(scr, /(?:wall|spine)\("recall", \{[^)]*zh: "他记得的"|setSub\("recall"\)/, "情侣空间里没有这一处入口");
  assert.match(scr, /dot: \(coupleRecall \|\| \[\]\)\.some\(function \(x\) \{ return x\.characterId === bCid && x\.unread; \}\)/, "新的那条不冒红点");
  assert.match(app, /coupleRecall: coupleRecall,/, "props 没递下去");
  assert.match(app, /setCoupleRecall\(loadJSON\("x_coupleRecall", \[\]\)\)/, "开机不读盘,重开就没了");
});
