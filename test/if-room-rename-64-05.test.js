// 「如果馆」改叫「另一种我们」（她 2026-09-05 定）。
// 判据是她自己那条：换个 app 还成立的名字，等于没说这是什么——「如果」谁都能用，
// 「另一种我们」得先真有你俩这段关系（在一起第几天、关系网上写着什么）才立得住。
//
// ⚠️改名最容易出的两件事，这条测试各钉一道：
//   ① 顺手把【存档键 / 组件名 / sub 路由】也改了 —— 她的旧存档当场读不出来；
//   ② 只改了界面，【言秋手上那本说明书没跟着改】—— 他嘴里还是旧名字
//      （她当场问的就是这个：「但是改了名字问秋秋知道吧」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const scr = read("screens.js"), man = read("assistant-manual.js"), app = read("app.js");

test("看得见的字都换了", () => {
  assert.match(scr, /h\(Head, \{ zh: "另一种我们", bg: "transparent", noLine: true, ink: IF_INK/, "页面标题没改");
  assert.match(scr, /letterSpacing: "\.16em", color: "rgba\(169,156,203,\.66\)" \} \}, "另一种我们"\)/, "墙上那一格的眉标没改");
  assert.match(scr, /"删掉这一种？"/);
  assert.match(scr, /"还没有想过另一种。"/);
  // 副标题那句本来就说得比名字还清楚，不动
  assert.match(scr, /同样的我们、同样这段关系，只换掉当初的一样东西/);
});

test("存档键、组件名、路由一个都没动——改了她的旧存档就读不出来了", () => {
  assert.match(app, /loadJSON\("x_ifLines", \[\]\)/, "存档键被改了");
  assert.match(scr, /sub === "ifroom"/, "路由被改了");
  assert.match(scr, /h\(IfRoom, \{ partner/, "组件名被改了");
  ["IF_INK", "IF_DIM", "IF_LINE", "IF_ACCENT"].forEach(k =>
    assert.ok(scr.indexOf(k) > 0, k + " 被改了"));
});

test("言秋手上那本说明书跟着改了，不然他嘴里还是旧名", () => {
  // 这本手册就是他「知道这个 app 有什么」的来源——一层写在两处，这是第二处
  assert.match(man, /【另一种我们】（同样的你俩，换掉当初的一样东西，会往下演；旧名叫如果馆）/);
  assert.match(man, /另一种我们（旧名如果馆）＝同样的你俩、只换掉当初的一样东西，再往下演；/);
  // 关键词两个名字都留着：她嘴里可能还说旧名，他得听得懂
  ["如果馆", "另一种我们"].forEach(k =>
    assert.ok((man.match(new RegExp('"' + k + '"', "g")) || []).length >= 2, "关键词里缺 " + k));
});

test("新落的图和新写进记忆的那条，用的是新名（旧记录不回头改）", () => {
  assert.match(app, /from: "另一种我们" \}\);/);
  assert.match(app, /text: "【另一种我们】" \+ line\.title/);
});

test("那一列长成【变化图】：一条主干 + 岔出去的几条虚线", () => {
  const seg = scr.slice(scr.indexOf("// ── 变化图（她 2026-09-05 定的形状）"), scr.indexOf('"还没有想过另一种。"'));
  assert.ok(seg.length > 600, "抠不出那一段");
  // 主干：实线，一路穿到底，而且【越过最后一条岔路还往下走一截】——
  // 你俩这条线不会因为最后一个如果就停了
  assert.match(seg, /paddingBottom: 22/);
  assert.match(seg, /position: "absolute", left: 9, top: 0, bottom: 0, width: 0, borderLeft: "1\.5px solid/);
  assert.match(seg, /"我们真走的这条"/);
  // 每一条如果都从主干上岔出去，不是并排的卡片
  assert.match(seg, /d: "M9 0 V10 C9 22 17 22 30 22"/);
  // ⚠️收没收不只靠颜色分（tabs-not-plain-pills.md 第 2 条）：线是虚是实、点是空是实，
  //   形状本身就不一样——色弱和阳光下只剩形状可依
  assert.match(seg, /strokeDasharray: x\.endedAt \? "" : "3 4"/, "虚实没分");
  assert.match(seg, /fill: x\.endedAt \? "#a99ccb" : "#181524"/, "空心实心没分");
});
