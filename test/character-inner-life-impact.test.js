// 「TA 是什么脾气」那一页：写在上面的话必须跟这几层【真在干的事】对得上。
//
// ⚠️v64.66 整页重写了一遍说法。她 2026-09-06：「这些描述都改改吧宝宝，到时候是要
//   发到小号给别人玩的，我自己知道原理就行了，对别人少说点太复杂的」。
//   所以这一份现在盯两件事：①说的是不是真的 ②有没有把行话摆给陌生人看。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const cut = (a, b) => { const i = source.indexOf(a), j = source.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return source.slice(i, j); };
// 这一页从「正在影响 TA」那一格到「时间感知」那一格之间
const PAGE = cut('const aGate = gateOf("A"), eGate = gateOf("E");', 'show("know", { title: "时间感知');

test("在跑的和没跑的分开列，标题上写着几项", () => {
  assert.match(source, /正在影响 TA · /);
  assert.match(source, /下面这几样，此刻真的在影响 " \+ cNm \+ " 怎么说话、什么时候来找你。/);
  // ⚠️没跑的那一栏空着就整块别出现：作息挪上去、关系轴关掉之后它常常一条都没有，
  //   剩个光秃秃的标题看着像加载失败。
  assert.match(source, /innerLifeImpact\.shadow\.length \? h\("div"[\s\S]{0,200}h\(Eyebrow, null, "还没派上用场"\)/);
});

test("A 和 E 常开；按过急停才退回只观察", () => {
  assert.match(source, /const _innerOff = aGate\.emergencyOff \|\| eGate\.emergencyOff;/);
  assert.ok(source.indexOf('aGate.mode === "pilot"') < 0, "还在按授权报状态——授权那一路从来没接过管子");
  assert.match(PAGE, /key: "E", title: "余温"/);
  assert.match(PAGE, /key: "A", title: "情绪"/, "A 接上了却没在这一栏里说");
  assert.match(PAGE, /情绪和余温：你按过急停，这两样先停着/, "急停之后不说话，等于看不出停没停");
  assert.match(PAGE, /不会翻旧账/, "余温那条得说清它不翻旧账");
  assert.match(PAGE, /这是背景，不是剧本/, "A 那条得说清它不替角色决定说什么");
});

test("关系那一层还关着，那一行也说人话", () => {
  assert.match(source, /shadow\.push\("你俩之间的疙瘩：只是记着，不会自己制造矛盾"\)/);
});

test("想起你（主动来找你）说清它不管普通回复", () => {
  assert.match(PAGE, /key: "dongnian", title: "想起你"/);
  assert.match(PAGE, /什么时候会自己来找你/);
  assert.match(PAGE, /攒够了才开口/);
  assert.match(source, /renderDongnianGauge\(\)/);
});

// v64.66：作息真的管事了（睡着时的语气 + 睡着不主动来找你），所以它从
// 「还没派上用场」挪进了「正在影响」。
test("作息列在【正在影响】里，而且只列给真排了作息的角色", () => {
  assert.match(PAGE, /key: "sleep", title: "作息"/);
  assert.match(PAGE, /if \(_hasSchedule\) live\.push\(/, "没排作息的人这一层对他不生效，列出来就是骗人");
  assert.match(source, /String\(q && q\.type\)\.toLowerCase\(\) === "sleep"/, "得真去日程里找睡觉那一段");
  assert.match(PAGE, /夜里被你叫醒会迷糊/);
  assert.match(PAGE, /睡着的时候不会主动来找你/);
  assert.match(PAGE, /按 " \+ cNm \+ " 那边的钟点算/, "异地的人得说清按谁那边的时间");
  // 它不该再出现在「还没派上用场」那一栏
  assert.ok(source.indexOf("C 睡眠意识：只算") < 0, "作息已经在跑了，不许还挂在观察那一栏");
});

// ── 发给别人玩：这一页上不许有行话 ──────────────────────────────────
test("这一页对陌生人不说行话", () => {
  // 内部代号、提示词工程词、模块名，一个都不许摆在这一页的正文里
  ["prompt", "模块", "影子", "注入", "投影", "十维", "token", "阈值",
   "A 情绪", "B 关系轴", "C 睡眠", "E 余温", "动念"].forEach(bad => {
    // 只查【显示出来的字符串】：注释里照旧可以写，那是给写代码的人看的
    const shown = PAGE.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    assert.ok(!shown.includes('"' + bad) && !shown.includes(bad + '"') && !shown.includes(bad + "：") && !shown.includes(bad + " "),
      "「" + bad + "」是行话，还摆在这一页上");
  });
});

test("那几个数默认收着，点一下才看得见", () => {
  assert.match(source, /const \[temperNumsOpen, setTemperNumsOpen\] = useState\(false\)/, "读数默认得是收起来的");
  assert.match(source, /const \[dnNumsOpen, setDnNumsOpen\] = useState\(false\)/);
  assert.match(source, /temperNumsOpen \? "把数字收起来 ▾" : "看数字 ▸"/);
  assert.match(source, /dnNumsOpen \? "收起 ▾" : "看数字 ▸"/);
  // 收起来的时候那一串键名不许露出来
  assert.match(source, /temperNumsOpen \? h\("div", null,[\s\S]{0,400}AXIS_ZH_MINI/);
  assert.match(source, /dnNumsOpen \? h\("div"[\s\S]{0,200}"此刻 " \+ c\.toFixed\(3\)/);
  // 英文键名要翻成中文（no-english-titles 那条的同一件事）
  assert.match(source, /const AXIS_ZH_MINI = \{ connection: "思念"/);
  assert.ok(!/mood 未命中|封顶触发|tokens"/.test(PAGE), "工程词还留在这一页上");
});

test("设置首页那一行不摆内部数字", () => {
  const home = cut('key: "temper", char: "性", title: "TA 是什么脾气"', 'key: "act"');
  assert.ok(!/dongnianState.*toFixed/.test(home), "「动念 0.28」这种不许摆在设置首页上");
  assert.match(home, /temperamentWords\(\)\.slice\(0, 3\)\.join\(" · "\)/, "这一栏该说这个人是什么样");
});
