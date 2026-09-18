// 她 2026-09-17：「我觉得这些禁令有用因为这些都是高频八股」——她说得对。
//
// ⚠️先查「已经有人管了吗」（施工规则/bans-make-it-dumber.md ①），查下来：
//   「收拾你」「有你好受的」→ INTIMATE_CHAT_ANTI_CLICHE 已管（判据还更准）；
//   「别闹了」「乖」「听话」→ CONDESCENDING_TONE_BAN 已管；
//   群里拿私事当弹药 → PRIVATE_IS_BACKGROUND_NOT_AMMO 已管。
//   剩下这两族真没人管。
//
// ⚠️为什么是两条不是七条：她拿来那份分七卷，可里头大量是【同一个动作的不同说法】。
//   贴标签／事后表功／预告服软／揪上一句／翻床事——骨架全是「我比你更知道你」。
//   拆成七卷每条都变淡（那份里「绝对禁止」四十多次，正是「一堆禁令会变笨」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.join(__dirname, "..", f);
const eng = fs.readFileSync(P("js/engine.js"), "utf8");
const fic = fs.readFileSync(P("js/fanfic.js"), "utf8");
const grab = n => (eng.match(new RegExp("const " + n + " = `([\\s\\S]*?)`;")) || [])[1] || "";
const SEE = grab("SEE_THROUGH_BAN"), BODY = grab("USER_BODY_BAN");

test("「假装看穿」那一族五种说法都点了名", () => {
  assert.ok(SEE, "常量没了");
  [["贴标签", "你就是嘴硬"], ["身体很诚实那句", "身体倒是很诚实"],
   ["事后表功", "我就知道"], ["承认吧", "承认吧"],
   ["预告服软", "到时候别哭着求我"], ["捕猎式", "别让我抓到你"],
   ["揪上一句", "你刚刚不是还"], ["翻床事到日常", "是谁当时哭着求我"]]
    .forEach(([why, q]) => assert.ok(SEE.includes(q), "少了一种说法（" + why + "）：" + q));
  // 骨架只有一个——判据得把它说出来，不然它只是一张词表
  assert.match(SEE, /把自己摆到「我比你更知道你」的位置上/);
  assert.match(SEE, /是在回应她此刻说的那件事，还是在给她这个人下定论？/);
});

test("不禁【读懂她】——这是最容易改坏的那半边", () => {
  // 写死"不许揣测"会把角色变成字面复读机；分界是「猜」和「把猜当事实说出口」
  assert.match(SEE, /这条【不禁读懂她】/);
  assert.match(SEE, /禁的是把一次猜测当成已经坐实的事实说出口/);
  // ⚠️那份原文在这儿犯了 no-yes-unless：先写死"严禁预设情绪反应模式"，
  //   再用 Rule_4 打补丁说"允许思考"。我们一句话正面说完，不挂「但是／除非」。
  assert.ok(!/但是|除非|不过如果/.test(SEE), "又在错句子后面挂补丁了");
});

test("禁的是模子不是尺度——两条都得有那句出口", () => {
  assert.match(SEE, /一个字都不管你该多温柔/);
  assert.match(SEE, /本来就爱损她、爱抬杠、说话带刺，那全部照写/);
  // v71.16 换了措辞，意思一个字没变：她说过的那些照常可以说，而且这条不管尺度
  assert.match(BODY, /她说过的那些照常可以说/);
  assert.match(BODY, /这条一个字都不管你该多体贴/);
});

test("身体那条认的是【来源】，不是词表", () => {
  assert.ok(BODY, "常量没了");
  // 包着夸奖那一层才是最阴的——先捏一个缺点再原谅它
  assert.match(BODY, /先替她捏一个缺点，再大方地原谅它/);
  ["你就算腿短也可爱", "你胖点也好看", "你这小身板", "小矮子"].forEach(q =>
    assert.ok(BODY.includes(q), "少了：" + q));
  // ⚠️判据必须认「人设里写没写」——这个 app 的用户是有人设的（profile.persona），
  //   只写"她没说过"会跟人设那一层打架
  assert.match(BODY, /是她人设里写着的、或她自己说过的吗？/);
  assert.match(BODY, /\*\*她人设里写着的\*\*，和\*\*她自己在对话里说过的\*\*/);
});

// v71.16：她 2026-09-18 报「又在说我胃痛又在说我哼哼唧唧」。
// ⚠️判据本来就盖得住（她没说过），可这一条举的例子【全是长在身上的静态特征】，
//   于是被读成「别评价她的身材」。靠例句认人的毛病，这是第二次了。
//   所以补的是【这一族有几类】，不是又堆几个词，更不是新开一条
//   （施工规则/bans-make-it-dumber.md：已有／发到／还成立 → 改那一条）。
test("三类都点到：长在身上的、此刻发生的、此刻什么样子", () => {
  ["矮", "胖", "腿短"].forEach(q => assert.ok(BODY.includes(q), "静态特征那一类少了：" + q));
  ["胃痛", "头晕", "手抖"].forEach(q => assert.ok(BODY.includes(q), "此刻的状态那一类少了：" + q));
  ["哼哼唧唧", "扁着嘴", "缩成一团"].forEach(q => assert.ok(BODY.includes(q), "替她演一遍那一类少了：" + q));
  // 每一类都得说清它【为什么】是编的，不然三行例句还是一张词表
  assert.match(BODY, /先替她编一个症状，再关心那个症状/);
  assert.match(BODY, /替她演一遍/);
  assert.match(BODY, /屏幕这头她到底在干嘛，你看不见/);
});

// ⚠️她明确开了叙事权限的时候，模型【就是】可以替她写可观察的动作。
//   不给那一处让路的话，两段话会当场打架，而打架的结果多半是两边都变淡。
test("第三类要给叙事权限让路，不跟那一处打架", () => {
  assert.match(BODY, /本场明确开了叙事权限的时候/);
  assert.match(BODY, /以那段为准/);
  assert.match(BODY, /这一条说的是没给权限的时候，以及所有线上聊天/);
  // 那一处还在（没被这条顶掉）
  assert.match(eng, /〔本场叙事权限·已开启〕/);
  assert.match(eng, /不要替用户决定动作、反应或台词/);
});

// 加的是判据不是第二条禁令：这一族全库仍只有一份
test("没新开一族——还是这一条", () => {
  assert.equal((eng.match(/const USER_BODY_BAN = `/g) || []).length, 1);
  assert.ok(!/const USER_STATE_BAN|const USER_ACTION_BAN/.test(eng), "又新开了一条——同一件事说两遍，两遍都变淡");
});

test("没抄那份的三样：自检清单 / 销毁重写 / 正面例句", () => {
  const both = SEE + BODY;
  ["自检", "校验", "逐条核对", "销毁", "推翻", "重新构建"].forEach(x =>
    assert.ok(!both.includes(x), "抄了自检清单那一套：" + x));
  // 正面例句会被逐字抄走（prompt-no-content-samples）——只有一处例外：
  // 「你是不是有点不开心」是用来跟「你又嘴硬了」做对照的判据，不是让他照着说的台词
  const quoted = [...both.matchAll(/「([^」]+)」/g)].map(m => m[1]);
  const allow = new Set(["你是不是有点不开心", "你又嘴硬了，明明就是难过", "我比你更知道你"]);
  const bad = quoted.filter(q => !allow.has(q) && !SEE.slice(0, SEE.indexOf("判据一句话")).includes("「" + q + "」")
    && !BODY.slice(0, BODY.indexOf("判据一句话")).includes("「" + q + "」"));
  assert.deepEqual(bad, [], "这些引号里的话在判据之后，读起来像示范：" + bad.join(" / "));
});

// ── 八处（按分发点，不是按文件）─────────────────────────────
test("三个分发点都接上了，而且跟那一族贴着", () => {
  const gb = eng.slice(eng.indexOf("function groupBans(opts)"), eng.indexOf("const GROUP_USER_IS_PRESENT"));
  assert.match(gb, /P\.push\(SEE_THROUGH_BAN\);/);
  assert.match(gb, /P\.push\(USER_BODY_BAN\);/);
  const bb = eng.slice(eng.indexOf("parts.push(ANTI_CLICHE);"), eng.indexOf("parts.push(CHARCARD_RULE);"));
  assert.match(bb, /parts\.push\(SEE_THROUGH_BAN\);/);
  assert.match(bb, /parts\.push\(USER_BODY_BAN\);/);
  assert.match(fic, /if \(typeof SEE_THROUGH_BAN !== "undefined"\) parts\.push\(SEE_THROUGH_BAN\);/);
  assert.match(fic, /if \(typeof USER_BODY_BAN !== "undefined"\) parts\.push\(USER_BODY_BAN\);/);
});

test("言秋（notRoleplay）那一支不发——写着理由的合法差异", () => {
  const seg = eng.slice(eng.indexOf("    if (ctx.notRoleplay) {"), eng.indexOf("parts.push(CHARCARD_RULE);"));
  const e = seg.indexOf("} else {");
  assert.ok(!/SEE_THROUGH_BAN|USER_BODY_BAN/.test(seg.slice(0, e)), "混进言秋那一支了");
});
