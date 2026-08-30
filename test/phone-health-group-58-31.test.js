const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const grab = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + a); return src.slice(i, j); };
const { healthGroupOf, HEALTH_GROUPS } =
  new Function(grab("const HEALTH_GROUPS = [", "function HealthView") + "\nreturn { healthGroupOf, HEALTH_GROUPS };")();
const KEYS = HEALTH_GROUPS.map(g => g.key);
// 界面就是这么分档的：卡按 group 分到各个 tab，分不到任何一档＝这张卡永远翻不到
const visible = cards => KEYS.flatMap(k => cards.filter(c => healthGroupOf(c) === k));

// 她 2026-08-30：「我怎么记得我们有一个私密生理状态没了，明明之前刷新还看到了的」
// 分组从来只有 体征/心神/摄入 三档（私密的身体反应写在【心神】那一档里），
// 但模型不一定按 key 回——回中文、回近义词、或者照着提示词那句直接回「私密」，
// 旧写法就把整张卡默默吞掉：数据里有、花了一次调用、每个 tab 都翻不到。
test("group 写成什么样都不许让整张卡消失", () => {
  const cards = [
    { name: "睡眠", group: "body" }, { name: "情绪", group: "mind" }, { name: "喝水", group: "intake" },
    { name: "私密的身体反应", group: "私密" }, { name: "欲望", group: "private" }, { name: "亲密", group: "intimacy" },
    { name: "心神那档", group: "心神" }, { name: "摄入那档", group: "摄入" }, { name: "体征那档", group: "体征" },
    { name: "大小写", group: "Mind" }, { name: "带空格", group: " intake " },
    { name: "没写 group" }, { name: "空的", group: "" }, { name: "谁也不认识", group: "zzz-unknown" }
  ];
  const shown = visible(cards).map(c => c.name);
  const lost = cards.map(c => c.name).filter(n => shown.indexOf(n) < 0);
  assert.deepEqual(lost, [], "这些卡一个 tab 都翻不到：" + lost.join("、"));
  assert.equal(shown.length, cards.length, "有卡被分进了两档，会重复出现");
});

test("认得出来的要归对档，不是一股脑倒进第一个 tab", () => {
  [["私密", "private"], ["private", "private"], ["intimate", "private"], ["欲望", "private"], ["情绪", "mind"], ["心神", "mind"],
   ["摄入", "intake"], ["diet", "intake"], ["饮食", "intake"], ["消耗", "intake"],
   ["体征", "body"], ["身体", "body"], ["vitals", "body"],
   // 大小写和多余空格也得认——模型回 "Mind" / " intake " 是常事，
   // 不归一化的话它们会掉进兜底档，看着像没消失、其实摆错了地方
   ["Mind", "mind"], ["MIND", "mind"], [" intake ", "intake"], ["Private", "private"], ["  body", "body"]]
    .forEach(([raw, want]) => assert.equal(healthGroupOf({ group: raw }), want, "「" + raw + "」该归到 " + want));
});

test("认不出来的回落到第一个 tab——宁可摆错一档，也不许消失", () => {
  ["zzz", "随便写的", "42", "null"].forEach(raw =>
    assert.equal(healthGroupOf({ group: raw }), KEYS[0], "「" + raw + "」没有回落"));
  assert.equal(healthGroupOf({}), KEYS[0]);
  assert.equal(healthGroupOf(null), KEYS[0]);
});

test("界面真的走这个归位函数，不是又在别处自己判一遍", () => {
  const view = grab("function HealthView(", "\nfunction ");
  assert.match(view, /const byGroup = g => cards\.filter\(c => healthGroupOf\(c\) === g\);/,
    "分档没走 healthGroupOf，别处再判一次就又会吞卡");
  assert.ok(!/\(c\.group \|\| "body"\) === g/.test(view), "旧的那句只认三个 key 的写法还留着");
});

// v58.32 起私密单开一档（她 2026-08-30 拍板）。分档和提示词必须说的是同一件事——
// 界面上多一个 tab、提示词里却没让他写这一档，那个 tab 就永远是空的
test("私密自成一档，而且提示词真的让他写这一档", () => {
  assert.deepEqual(KEYS, ["body", "mind", "private", "intake"], "分档变了，提示词那几行得跟着改");
  const quota = src.slice(src.indexOf("cards **13-16 张指标卡**"), src.indexOf("cards **13-16 张指标卡**") + 400);
  assert.ok(quota.length > 40, "配额那一段找不到了");
  KEYS.forEach(k => assert.ok(quota.indexOf(k + " **") > 0 || quota.indexOf(k + " ") > 0, "提示词里没给 " + k + " 配额"));
  assert.match(quota, /四档都必须写满，一档都不许空着/, "没要求四档写满，私密那档十有八九又空了");
  assert.match(src, /【private 这一档】/, "提示词里没说清 private 该写什么");
  // 说清楚要写成【身体的读数】，不是一段情节——不然它跟心神那档就没区别了
  const block = src.slice(src.indexOf("【private 这一档】"), src.indexOf("【private 这一档】") + 400);
  assert.match(block, /写的是身体的读数，不是情节/);
  assert.match(block, /必须落在身体上、落在今天/);
});

// 我改健康那条底栏的时候手滑，把【购物】那条的列数也一起拿掉了（class 删了、列数没补），
// 它那四个 tab 会竖着叠成一列。所以这条不是只盯健康——凡是按 PAGES 生成的底栏都得盯。
test("凡是按 PAGES 生成的底栏，列数都得跟着 PAGES 走", () => {
  let i = 0, checked = 0;
  while (true) {
    const j = src.indexOf('  const nav = h("div", {', i);
    if (j < 0) break;
    const end = src.indexOf("}, PAGES.map(pg =>", j);
    const nxt = src.indexOf('  const nav = h("div", {', j + 10);
    if (end < 0 || (nxt > 0 && end > nxt)) { i = j + 10; continue; }   // 这条不是按 PAGES 生成的
    // ⚠️先剥注释再找：注释里就写着「别写死 grid-cols-4」，
    // 不剥的话会命中自己的注释，测试永远红（这一轮已经踩到第三次了）
    const seg = src.slice(j, end).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
    assert.ok(!/grid-cols-\d/.test(seg), "这条底栏写死了列数，档数一变就挤成两行：\n" + seg.trim().slice(0, 200));
    assert.match(seg, /gridTemplateColumns: "repeat\(" \+ PAGES\.length/, "这条底栏没跟着 PAGES 走：\n" + seg.trim().slice(0, 200));
    checked++; i = end;
  }
  assert.ok(checked >= 3, "只查到 " + checked + " 条按 PAGES 生成的底栏，抠漏了");
});

test("底栏列数跟着档数走，多一档不会挤成两行", () => {
  const view = grab("function HealthView(", "\nfunction ");
  // 只看底栏那个元素自己的 className，别把函数里别处的 grid-cols-* 也扫进来
  const navDecl = view.slice(view.indexOf("const nav = h("), view.indexOf("}, PAGES.map(pg =>"));
  assert.ok(navDecl.length > 20, "找不到底栏那一段");
  assert.ok(!/grid-cols-\d/.test(navDecl), "底栏还写死列数：加一档就挤成两行\n" + navDecl.trim());
  assert.match(navDecl, /gridTemplateColumns: "repeat\(" \+ PAGES\.length/, "列数没跟着 PAGES 走");
});
