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
const _lvi = app.indexOf("  const leaveInCoupleSpace = async (char, styleHint) => {");
const leave = app.slice(_lvi, app.indexOf("\n  };", _lvi) + 4);

// ── c 同一件事的两个版本 ──────────────────────────────────────────────────
test("挑的是你俩【都在场】的事，问过的不再问第二遍", () => {
  assert.match(rec, /\(m\.charIds \|\| \[\]\)\.includes\(char\.id\)/, "挑到了跟他无关的事");
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
  assert.ok(!/h\(Sheet/.test(ui), "用了半窗——见 .claude/rules/no-half-sheet.md");
});

// ── b 他趁你不在动过这里 ──────────────────────────────────────────────────
// ⚠️这一条的全部意义在于【不多花钱】：App 里本来就有「思念出口」，这里只是多一个出口。
test("不新开定时器、不多花一次调用——只是把思念的出口换了一个", () => {
  const fire = grab(app, "          if (activeOffScene) offlineReply(cid);", "          return; // 一次一个，错峰");
  assert.match(fire, /else if \(\(\(couplesRef\.current \|\| \{\}\)\[cid\] \|\| \{\}\)\.status === "together" && Math\.random\(\) < 0\.3\)\n *leaveInCoupleSpace\(c, jwStyle\);/,
    "没接在思念那条现成的链上,或者不是 else 分支（那就是多花一次）");
  assert.ok(fire.indexOf("else replyNow(cid") > fire.indexOf("leaveInCoupleSpace"), "留东西和发消息不是二选一——那就变成两次了");
  // 只对正式在一起的那位；三成，天天留就成了另一种刷屏
  assert.match(fire, /status === "together"/, "没在一起的也往情侣空间里塞");
  assert.match(fire, /Math\.random\(\) < 0\.3/, "概率没有卡住");
  assert.ok(!/setInterval|setTimeout/.test(nocomment(leave)), "自己又开了一条定时器");
});

test("留下的东西落进的是【已经会渲染它】的那两个地方", () => {
  // 便签墙本来就认 authorId === partner.id 的顶层便签；时光轴本来就认 byCharacter
  assert.match(leave, /authorId: char\.id, content: txt/, "便签没署他的名,墙上认不出是他留的");
  assert.match(scr, /const hasHis = n\.authorId === partner\.id \|\| \(n\.replies \|\| \[\]\)\.some\(r => r\.authorId === partner\.id\)/, "便签墙不认他的顶层便签了");
  assert.match(leave, /byCharacter: true, unread: true/, "时光轴那条没标成他写的");
  assert.match(scr, /ev\.byCharacter \?/, "时光轴不认 byCharacter 了");
  assert.match(leave, /saveJSON\("x_coupleNotes", n\)/); assert.match(leave, /saveJSON\("x_coupleTimeline", n\)/);
  // 她不在场，所以不该写成给她的留言模板
  assert.match(leave, /她不在场，所以不用问她好、不用等她回/, "会写成一条对着她说的留言");
  assert.match(leave, /等她自己发现/, "没说清这件事的意思是「回来才发现」");
  assert.match(leave, /catch \(e\) \{ console\.warn\("\[couple leave\]"/, "失败会把那一轮思念整个炸掉");
});

test("入口和红点都在，不是写了没人能点到", () => {
  assert.match(scr, /sub === "recall"/, "没有分发");
  // ⚠️别把 emoji 冻进来：v59.21 整页把 emoji 撤了，换成水印汉字
  assert.match(scr, /tile\("recall", \{[^)]*zh: "他记得的"/, "网格里没有这一格");
  assert.match(scr, /dot: \(coupleRecall \|\| \[\]\)\.some\(function \(x\) \{ return x\.characterId === partner\.id && x\.unread; \}\)/, "新的那条不冒红点");
  assert.match(app, /coupleRecall: coupleRecall,/, "props 没递下去");
  assert.match(app, /setCoupleRecall\(loadJSON\("x_coupleRecall", \[\]\)\)/, "开机不读盘,重开就没了");
});
