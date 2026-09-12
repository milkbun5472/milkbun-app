// 她 2026-09-12（状态卡截图）：「而且还是很八股的用词」。
// 她圈的是连着两条心声：
//   「她怎么能这么面不改色地把这两个字叫出来的……脸都要烧起来了。」
//   「她到底怎么能脸不红心不跳地喊出这个称呼的……我整个人都要被她逗冒烟了。」
// 同一句话换了个说法，而且两条都是【给对方的行为下判词 + 一句收口】。
// 三条动作也一样：「我坐在沙发上把 Lisa 圈在怀里…」「松开肩膀转而拉回怀里抱紧…」
//   「握着 Lisa 的肩膀，整张脸瞬间涨得通红…」——一个骨架换三次。
//
// 病根还是那一个：**一层写在两处，第二处没跟上**。线上那份 thought 说明逐条管着
// 「判词收口」「别换个说法重说」「称谓」，而线下 OFFLINE_PROTOCOL_V2 里那一份是它的
// 【短拷贝】，这几条一条都没有；action 更糟——线下写着「几乎每一拍都不一样，别照抄」，
// 和 ACT_MEANING 的「事实没变就原样填写」**正好相反**。
// 同一个字段第三次了（v67.26 是 action 定义、v67.35 是动描反八股），所以这回抠成一份。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const engine = R("js/engine.js"), app = R("js/app.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const E = strip(engine), A = strip(app);
const TM = (engine.match(/const THOUGHT_MEANING = "([^"]+)";/) || [])[1];
const AM = (engine.match(/const ACT_MEANING = "([^"]+)";/) || [])[1];

test("心声那一格只许有一份定义", () => {
  assert.ok(TM, "THOUGHT_MEANING 没了");
  assert.equal((E.match(/const THOUGHT_MEANING = /g) || []).length, 1);
  // 线上和线下各取一次；别处不许再抄一份
  assert.equal((A.match(/\$\{THOUGHT_MEANING\}/g) || []).length, 1, "线上那一处没取公共的");
  assert.equal((E.match(/\$\{THOUGHT_MEANING\}/g) || []).length, 1, "线下那一处没取公共的");
  assert.ok(A.indexOf("写角色本人脑中此刻真正闪过") < 0, "app.js 里还留着一份原文");
});

test("她圈的那两样，这一份里逐条都在", () => {
  assert.match(TM, /禁止给对方的行为下判词再给这一轮盖章收尾/, "「她怎么能……」+ 收口那一族");
  assert.match(TM, /心声可以没有结尾/);
  assert.match(TM, /别把上一条心声换个说法再写一遍/, "两条心声同一个意思换几个词，这条专治");
  assert.match(TM, /同一个意思换几个词重说，比重复更难看/);
  assert.match(TM, /这女人/, "网文旁观称谓那一族");
});

test("共用之后不写死字段名（线上说出口的是 word，线下是 scene 里的对白）", () => {
  assert.ok(TM.indexOf("写进 word") < 0, "写死了 word，线下那一处就读不通");
  assert.match(TM, /真要撂就让 TA 听见/);
  assert.match(TM, /想说的话仍要用这个人自己的方式说出口/);
});

// ── action：线下那一份原来跟 ACT_MEANING 正好相反 ────────────────
test("线下的 action 也接公共那一份，不再自己写一套", () => {
  assert.ok(AM, "ACT_MEANING 没了");
  assert.equal((E.match(/\$\{ACT_MEANING\}/g) || []).length, 1, "线下那一处没取公共的");
  assert.equal((A.match(/ACT_MEANING/g) || []).length, 2, "线上一处、群聊一处");
  // 那句相反的话必须是【删掉】，不是在后面挂个「但是」（施工规则/no-yes-unless.md）
  assert.ok(E.indexOf("几乎每一拍都不一样，上一轮那句已经过去了，别照抄") < 0, "相反那句还在");
});

test("线下独有的那半句留着，但口径跟公共那份对得上", () => {
  const i = E.indexOf("action 每轮必须填写，禁止 null、空串或省略：${ACT_MEANING}");
  assert.ok(i > 0, "线下那一格没接上");
  const blk = E.slice(i, i + 260);
  assert.match(blk, /线下是一场正在推进的戏，这一格的事实本来就比线上变得快/, "线下确实变得快，这个差异要留着");
  assert.match(blk, /【事实真的变了】才更新，不是每一拍都换个说法/);
  assert.match(blk, /同一件事还在做，就照实写回同一句/);
  // 公共那份里那两句是这一条的靠山，别被顺手删了
  assert.match(AM, /当前事实未变且原表述仍准确时，可以原样填写/);
  assert.match(AM, /神态、语气、和对方之间的那些来回属于正文/, "她那三条动作里塞满的正是这些");
});

test("线上那两格一个字没改坏（它们本来就是对的）", () => {
  assert.match(A, /thought: string，【每轮必须写一句，禁止 null、空串或省略】。\$\{THOUGHT_MEANING\}/);
  assert.match(A, /action: string，每轮回复完成后\$\{ACT_MEANING\}或在 word 中报备。/);
  assert.ok(!/。$/.test(AM), "ACT_MEANING 结尾带句号，线上那句会读不通");
});

test("病历留在代码里，别让下一个人又把线下那份抄回去", () => {
  const i = engine.indexOf("const THOUGHT_MEANING = ");
  const doc = engine.slice(Math.max(0, i - 1200), i);
  assert.match(doc, /线下那一份是它的一个【短拷贝】/);
  assert.match(doc, /同一个字段第三次了/);
  assert.match(doc, /2026-09-12/);
});
