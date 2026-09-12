// 她 2026-09-12：「但是为啥单聊可以一个人一轮一个动作，到了群聊他们连续发两三天
//                   还是每轮都有动作，这不对吧」
//
// 病根**不在更新策略**——v67.18 已经把「没变就原样填写」在两处统一过一次了。
// 在【定义本身】：
//   单聊写的是「此刻真正正在做的事**或所处的活动状态**」——能持续一阵子的那种；
//   群聊写的是「**发这句话时**正在做的一件事」——按定义就是每句一换。
// 后者一换，那句「没变就别换」永远用不上，代码那道去重闸（比字符串）也永远拦不住。
//
// 第二半：「上一动作=X」原来只在【记忆互通】开着时才喂给模型，
// 可 action 这一格是【互通 或 动描】两个来源都会要的——只开动描的群，
// 模型被要求填这一格却从没见过上一次填的是什么，根本没法「原样填写」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), engine = R("js/engine.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app), E = strip(engine);

const ACT_MEANING = (function () {
  const m = engine.match(/const ACT_MEANING = "([^"]+)";/);
  assert.ok(m, "engine.js 里没有 ACT_MEANING");
  return m[1];
})();

test("「action 指什么」只许有一个说法", () => {
  assert.equal((E.match(/const ACT_MEANING = /g) || []).length, 1, "只许定义一处");
  assert.equal((A.match(/ACT_MEANING/g) || []).length, 2, "单聊一处、群聊一处，各取一次");
  assert.match(A, /action: string，每轮回复完成后\$\{ACT_MEANING\}或在 word 中报备。/, "单聊那一行要从这儿取");
  assert.match(A, /const G_ACTION_SPEC = ACT_MEANING \+ /, "群聊那一格也要从这儿取");
});

test("定义说的是【能持续的活动状态】，不是【说这句话时的小动作】", () => {
  assert.match(ACT_MEANING, /此刻真正正在做的事或所处的活动状态/);
  assert.match(ACT_MEANING, /当前事实未变且原表述仍准确时，可以原样填写/, "没有这半句，去重闸就没意义");
  // 「发这句话时」那种定义按字面就是每句一换，那条政策永远用不上
  assert.ok(A.indexOf("发这句话时正在做的一件事") < 0, "群聊那边按句计的定义又长回来了");
  assert.ok(ACT_MEANING.indexOf("发这句话时") < 0);
});

test("单聊那一行拼出来还是一句读得通的话（v67.35 补了形状那一句）", () => {
  const rebuilt = "action: string，每轮回复完成后" + ACT_MEANING + "或在 word 中报备。";
  assert.equal(rebuilt,
    "action: string，每轮回复完成后如实填写角色此刻真正正在做的事或所处的活动状态；" +
    "这是角色自己的实时状态卡，必须用第一人称「我」写，禁止用角色名或「他／她／TA」从旁描述。" +
    "它答的是【我此刻在哪儿、在做什么】，一句话说完就够；神态、语气、和对方之间的那些来回属于正文，" +
    "写在你说的话那一头，别挪进这一行。" +
    "当前事实未变且原表述仍准确时，可以原样填写；事实变化时再更新。无需为了交字段换措辞、制造动作或在 word 中报备。");
  // 尾巴不许带句号，不然单聊那句会变成「…制造动作。或在 word 中报备。」
  assert.ok(!/。$/.test(ACT_MEANING), "ACT_MEANING 结尾带了句号，单聊那句会读不通");
});

// ── 第二半：他得知道上一次填的是什么，才谈得上「原样填写」──────────────
test("上一动作在【动描开着】时也要喂给他，不只互通", () => {
  const i = A.indexOf("live: (function () {");
  assert.ok(i > 0, "那一格的形状变了");
  const blk = A.slice(i, i + 500);
  assert.match(blk, /if \(\(o\.interop \|\| o\.act\) && fa\) bits\.push\("上一动作=" \+ fa\)/,
    "只开动描的群，他从没见过上一次填的是什么，没法原样填写");
  // 穿着照旧只归互通：那是状态卡的事，跟动描没关系
  assert.match(blk, /if \(o\.interop && fw\) bits\.push\("穿着=" \+ fw\)/);
  assert.ok(A.indexOf('live: o.interop && (fw || fa) ?') < 0, "老那版还留着");
});

test("群回复那一处要把动描开关传下去", () => {
  assert.match(A, /groupNowSegs\(c, \{ interop: gs\.memoryInterop, act: !!gs\.actDesc \}\)/,
    "不传的话上面那一半等于白写");
});

// ── 拼出来真是那个形状（把两段真跑一遍，不只对着源码认字）──────────────
test("群聊那一格拼出来，说的跟单聊是同一件事", () => {
  const i = app.indexOf("const G_ACTION_SPEC = ACT_MEANING + ");
  const line = app.slice(i, app.indexOf("\n", i));
  const tail = line.match(/ACT_MEANING \+ "([^"]+)";/);
  assert.ok(tail, "抠不出群聊那一格的尾巴：" + line);
  const spec = ACT_MEANING + tail[1];
  assert.match(spec, /所处的活动状态/, "群聊这一格也得是「活动状态」，不是「这句话时的动作」");
  assert.match(spec, /原样填写/);
  assert.match(spec, /不必每条都换一个新的/, "群里一个人连发好几条，不该条条换一个动作");
});

// v67.18 那道代码闸还在（定义改对了，闸也得在——规则只降概率）
test("「没变就别刷屏」那道闸没被顺手动掉", () => {
  assert.match(E, /function sameActLine\(a, b\)/);
  assert.equal((A.match(/sameActLine\(/g) || []).length, 2, "单聊和群聊两处都要走它");
});
