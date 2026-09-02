const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GB = require("./_group-bans.js");
const root = path.join(__dirname, "..");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-09-02：「怎么又开始收拾我了这个 gemini 一到这种时候就八股」。
// 三条原话全是【单聊线上】的气泡：
//   「等快递到了你看我怎么收拾你」「我什么时候少舔你了」「哪次不是…你才肯罢休」。
// 查下来是老那一个病：INTIMATE_ANTI_CLICHE 从来只挂在【线下叙事】和【群线下】，
// 单聊线上／群线上／通话【一条情欲反模板都没有】。

const bundle = eng.slice(eng.indexOf("if (ctx.notRoleplay) {"), eng.indexOf("// 用户通过 OOC 立下的长期行为准则"));
const narrCore = eng.slice(eng.indexOf("function narrativeCore(opts) {"), eng.indexOf("\n}", eng.indexOf("function narrativeCore(opts) {")));

test("单人线上（＝单人通话也走这份）终于吃得到情欲反八股", () => {
  const rp = bundle.slice(bundle.indexOf("} else {"));
  assert.match(rp, /parts\.push\(INTIMATE_CHAT_ANTI_CLICHE\);/,
    "buildBundle 的扮演支没接上——单聊线上和单人通话就是这么一条都没有的");
});

test("言秋那一支一条扮演类规则都不许多给", () => {
  const nr = bundle.slice(0, bundle.indexOf("} else {"));
  assert.ok(!/INTIMATE_CHAT_ANTI_CLICHE/.test(nr),
    "数字生命不发扮演三件套，这条也不许漏进 notRoleplay 那一支");
});

test("三处群（线上/线下/通话）一处不落", () => {
  assert.ok(GB.allGroupsHave("INTIMATE_CHAT_ANTI_CLICHE"),
    "群线上/群线下/群通话必须都吃得到");
});

test("单人线下写正文时也给——正文里同样有台词", () => {
  assert.match(narrCore, /if \(opts\.intimate\) \{[^}]*INTIMATE_CHAT_ANTI_CLICHE/,
    "线下那一份 INTIMATE_ANTI_CLICHE 通篇在管描写，管不到台词");
});

test("这一条禁的是台词的骨架，不是某几个字", () => {
  const c = eng.slice(eng.indexOf("const INTIMATE_CHAT_ANTI_CLICHE = `"));
  const body = c.slice(0, c.indexOf("`;") + 2);
  // 威胁式挑逗和反问式表功是她那三条的两个骨架，都得点名
  assert.ok(body.includes("威胁式挑逗"), "「等你X了看我怎么收拾你」那一族没点名");
  assert.ok(body.includes("反问式表功"), "「我什么时候少X了」那一族没点名");
  // 「换个角色还照样成立的就是写坏了」——全仓通用的那把尺，这条也得有
  assert.ok(/一个字都不用改也成立/.test(body), "少了那把判据尺子");
  // 禁的是模子不是尺度：不许把这条写成"别荤"
  assert.ok(/禁的是模子，不是尺度/.test(body),
    "写成禁尺度就废了——她要的是这个人自己的荤话，不是不许荤");
});

test("不是把线下那份原样搬上来", () => {
  const c = eng.slice(eng.indexOf("const INTIMATE_CHAT_ANTI_CLICHE = `"));
  const body = c.slice(0, c.indexOf("`;") + 2);
  // 线下那份通篇在管【描写】：嗓音怎么形容、埋脸、比喻限额。线上没有描写，只有台词。
  ["低沉沙哑", "埋进", "比喻"].forEach(w =>
    assert.ok(!body.includes(w), "把线下管描写的那一份搬上来了：" + w));
});

test("「收拾你」原来就写在训话腔那条里，照样漏——所以这条不能也只是一张词表", () => {
  assert.ok(eng.includes("收拾你"), "训话腔那条里的词表不该被删");
  const c = eng.slice(eng.indexOf("// 情欲【气泡】反八股"));
  assert.ok(/CONDESCENDING_TONE_BAN/.test(c.slice(0, c.indexOf("const INTIMATE_CHAT_ANTI_CLICHE"))),
    "注释里要留着这个教训：一个词禁在哪个类目下，决定它在什么场面被想起来");
});
