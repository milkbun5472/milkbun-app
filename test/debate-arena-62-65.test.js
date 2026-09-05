// v62.65 审美审计（2026-09-04）：擂台的【存档列表】和【摆台子】是通用列表 + 标准表单，
// 而**这个 app 的语言早就有了**——擂台本身（台面线、台裙、挂绳、立场牌、
// 吊着的记分牌）是全库为数不多判【合格】的页面之一。
// 审计还点出一条：「页底仍是米白，台子以外没有场地」。
//
// 所以这一版不发明新东西，是让另外两页长回那座台子上。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/debate.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("三页都站在同一块场地上", () => {
  // 台子以外那一片也是场地，不是米白
  assert.equal((NOC.match(/pageSkin\("cloth", t, \{ strength: \.55, corner: false \}\)/g) || []).length, 3,
    "有一页还悬在米白上");
  // ⚠️光有那三份 style 不算数，还得真挂到外壳上——只断言「算出来了」，
  //   把 style: arenaFloor 那一句删掉照样绿（变异验证时正是这么漏过去的）。
  assert.equal((NOC.match(/className: "h-full flex flex-col", style: arenaFloor2?\b/g) || []).length, 3,
    "有一页算了场地却没挂上去");
  assert.equal((NOC.match(/bg: "transparent"/g) || []).length, 2, "顶栏没让底透上来");
});

test("一场存档＝一张贴在台边的战报：顶上一道台面线，线下是台裙", () => {
  const list = NOC.slice(NOC.indexOf("const arenaFloor ="), NOC.indexOf("长按可删除存档"));
  assert.match(list, /borderTop: "3px solid " \+ modeInk/);
  assert.match(list, /background: "linear-gradient\(180deg,rgba\(255,255,255,\.52\)/);
  // 左 4px 色条 + 圆角 13 的通用列表项不许再回来
  assert.doesNotMatch(list, /borderRadius: "4px 13px 13px 4px"/);
  assert.doesNotMatch(list, /borderLeft: "4px solid " \+ modeInk/);
  // 那枚歪着盖的「胜」章本来就是对的，原样留着
  assert.match(list, /transform: "rotate\(-9deg\)"/);
});

test("「摆一场擂台」是支起来的一块空台面，不是虚线新建按钮", () => {
  assert.doesNotMatch(NOC, /"＋ 摆一场擂台"/);
  const btn = NOC.slice(NOC.indexOf('setView("setup"); },'), NOC.indexOf('}, "摆一场擂台")'));
  // ⚠️空台面的线要比有人的那几张淡：满黑的一道 3px 看着是分隔线，不是台子
  assert.match(btn, /borderTop: "3px solid " \+ t\.fog/);
  assert.doesNotMatch(btn, /dashed/);
});

test("摆台子每一栏的抬头也压一道台面线", () => {
  assert.match(NOC, /const label = \{[\s\S]{0,220}borderTop: "3px solid " \+ t\.line, paddingTop: 9/);
});
