// 她 2026-09-12（截图：状态卡「此刻」里连着三条动描）：「还有这些动作好言情八股啊宝宝」
//
// 那三条长这样——一个骨架换几个近义词又写了两遍：
//   「我闭着眼侧躺在床头，手臂收紧把 Lisa 牢牢按在自己怀里，下巴抵着她的发旋，语气低缓却毫无退路。」
//   「我闭着眼睛侧躺在 Lisa 身侧，手臂收紧把她彻底裹在怀里，下巴轻蹭了蹭她的发顶，嘴角带着点拿她没辙的弧度。」
//   「我闭着眼睛侧躺在 Lisa 身侧，手臂依旧稳稳环在她腰上，嘴角压不住地轻扯了一下，由着她整个人陷在自己怀里。」
//
// 病根不是「没写禁令」，而是**已经写好的那一份没发到这一处**：
// NARRATIVE_ANTI_CLICHE 里【通用舞台指示】（唇角勾起一抹弧度）、【别陷入固定节奏】
// （动作＋台词＋心理总结三段式）、【不替读者定情绪分量】（「语气低缓却毫无退路」）
// 三条正好逐条对上她圈的东西——而线上一个字都收不到。
// v60.45 那次已经推翻过「线上没有描写」这个理由，可只把【情欲】那一半搬了过来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const engine = R("js/engine.js"), app = R("js/app.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const E = strip(engine), A = strip(app);

// 真拼出来看，不只对着源码认字
const F = (() => {
  const i = engine.indexOf("const INTIMATE_ANTI_CLICHE_LEGACY_V1 = ");
  const j = engine.indexOf("\n// 成长准则", i);
  assert.ok(i > 0 && j > i, "抠不出那几份常量");
  return new Function(engine.slice(i, j) + "\nreturn { NARRATIVE_ANTI_CLICHE, NARRATIVE_ACT_CLICHE, INTIMATE_ACT_CLICHE };")();
})();

test("动描那一行拿到的是【叙事反陈词滥调】那一份，不是另抄一遍", () => {
  const full = F.NARRATIVE_ANTI_CLICHE.split("\n"), act = F.NARRATIVE_ACT_CLICHE.split("\n");
  // 除了抬头和滤掉的那一条，逐行必须是同一份原文
  const kept = full.slice(1).filter(l => l.indexOf("台词要有人味") < 0);
  assert.deepEqual(act.slice(1), kept, "正文被抄了第二遍——以后往上面加一条，这一份就跟不上了");
  assert.ok(act.length > 8, "滤得只剩几条了：" + act.length);
});

test("她圈的那三样，这一份里逐条都在", () => {
  assert.match(F.NARRATIVE_ACT_CLICHE, /【动作\/神态别用通用舞台指示】/, "「嘴角带着点…的弧度」归它管");
  assert.match(F.NARRATIVE_ACT_CLICHE, /勾起唇角／唇角勾起一抹弧度/);
  assert.match(F.NARRATIVE_ACT_CLICHE, /【别陷入固定节奏】/, "三条一个骨架归它管");
  assert.match(F.NARRATIVE_ACT_CLICHE, /【叙述者不替读者定情绪分量·核心铁律】/, "「语气低缓却毫无退路」归它管");
});

test("抬头必须换掉：原来那句说的是【第三人称叙事散文】，动描是第一人称一行", () => {
  assert.match(F.NARRATIVE_ANTI_CLICHE, /^【线下叙事 · 反陈词滥调（写第三人称叙事散文时持续生效/, "上面那一份的抬头动了");
  assert.ok(F.NARRATIVE_ACT_CLICHE.indexOf("写第三人称叙事散文时持续生效") < 0,
    "抬头照搬过去，模型会判定这一处用不上，整块白发（v60.45 学到的那一条）");
  assert.match(F.NARRATIVE_ACT_CLICHE, /^【这一行也是描写 · 反陈词滥调（动描那一行持续生效/);
});

test("滤掉的是【只对连续正文成立】的那一条，别的一条都不许少", () => {
  assert.ok(F.NARRATIVE_ACT_CLICHE.indexOf("台词要有人味") < 0, "台词归正文，不归这一行");
  assert.ok(F.NARRATIVE_ACT_CLICHE.indexOf("多人同处时别写成一人一句轮流表态") < 0);
  // 这几条对一行照样成立，少一条就等于白改
  ["比喻限额", "别把情绪列成清单贴标签", "能用动词就别堆形容", "用词替换禁令表", "整类描写禁令"]
    .forEach(k => assert.ok(F.NARRATIVE_ACT_CLICHE.indexOf(k) >= 0, "「" + k + "」被顺手滤掉了"));
});

// ── 四处一样喂：开了动描的两处线上都要发 ──────────────────────────
test("单聊线上和群线上都发，而且是【开了动描才发】", () => {
  assert.match(A, /\(_actDesc \? "\\n\\n" \+ ownActNoBracketRule\(uName\) \+ "\\n\\n" \+ NARRATIVE_ACT_CLICHE \+ "\\n\\n" \+ INTIMATE_ACT_CLICHE : ""\)/, "单聊线上没接上");
  assert.match(A, /\(_gActDesc \? "\\n\\n" \+ ownActNoBracketRule\(userName\(profile\)\) \+ "\\n\\n" \+ NARRATIVE_ACT_CLICHE \+ "\\n\\n" \+ INTIMATE_ACT_CLICHE : ""\)/, "群线上没接上（只修一处就是老毛病）");
  assert.equal((A.match(/NARRATIVE_ACT_CLICHE/g) || []).length, 2, "开了动描的线上只有这两处");
});

test("情欲那一半没被顶掉——两份各管各的", () => {
  assert.equal((A.match(/INTIMATE_ACT_CLICHE/g) || []).length, 2);
  assert.ok(F.INTIMATE_ACT_CLICHE.indexOf("【绝不 OOC / 不跳戏】") < 0, "情欲那一份的滤法被动过了");
});

test("线下照旧走整份（它本来就有，别顺手又发一遍）", () => {
  assert.match(E, /if \(opts\.bans !== false\) parts\.push\(NARRATIVE_ANTI_CLICHE\);/);
  assert.match(E, /if \(opts\.narrative\) \{ P\.push\(INTIMATE_ANTI_CLICHE\); P\.push\(NARRATIVE_ANTI_CLICHE\); \}/);
});

// ── 这一格该长什么样：正面给形状 ───────────────────────────────
test("action 那一格说清了它答的是什么，别的东西各自有家可回", () => {
  const m = engine.match(/const ACT_MEANING = "([^"]+)";/);
  assert.ok(m, "ACT_MEANING 没了");
  const ACT = m[1];
  assert.match(ACT, /它答的是【我此刻在哪儿、在做什么】，一句话说完就够/, "不说形状，它就按最熟的那个体裁填");
  assert.match(ACT, /神态、语气、和对方之间的那些来回属于正文/, "得给它们一个家，不是只说「不许写」");
  assert.match(ACT, /当前事实未变且原表述仍准确时，可以原样填写/, "原来那句不许丢");
  assert.ok(!/。$/.test(ACT), "结尾带句号，单聊那句会读不通");
  // ⚠️别在这一格里堆禁令（她 2026-09-12 那条规矩：越小气它越偷懒）
  assert.ok((ACT.match(/禁止|不许/g) || []).length <= 1, "这一格里的禁令堆多了：" + ACT);
});

test("两处仍然共用同一份定义", () => {
  assert.equal((E.match(/const ACT_MEANING = /g) || []).length, 1);
  assert.equal((A.match(/ACT_MEANING/g) || []).length, 2, "单聊一处、群聊一处");
});

// ⚠️这一条是【反过来钉】：别再去加一道模糊去重。实测它的分离方向是反的。
test("为什么不靠代码去重把重复那几条挡掉，理由写在代码里", () => {
  const i = engine.indexOf("const ACT_MEANING = ");
  const doc = engine.slice(Math.max(0, i - 900), i);
  assert.match(doc, /去重那道闸/, "得说清为什么这道闸在长句上没用");
  assert.match(doc, /一段场面描写永远不会「原表述仍准确」/);
  // 闸本身照旧留着：句子变短之后它才真的开始管用
  assert.match(E, /function sameActLine\(a, b\)/);
  assert.equal((A.match(/sameActLine\(/g) || []).length, 2, "单聊和群聊两处都要走它");
});
