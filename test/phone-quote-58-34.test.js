const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPhone, SRC } = require("./helpers/phone-render.js");
const P = loadPhone();
const char = { id: "c1", name: "江识" };
const spec = known => P.phoneProbeSpec("health", char, [], "", [], known).instruction;

// 她 2026-08-30：「然后这一块的 quote 就开始八股要连本带利收回来了。。。」
// 健康那份是 ♻️（每次整份重写），模型没有上一轮的记忆，于是每次都从同一个先验里
// 捞同一句出来。提示词立判据只降概率，这一道才是代码保证。
test("上一轮说过的句子原样发回去，并且说明白不许重复", () => {
  const known = {
    cards: [{ quote: "连本带利收回来。" }, { quote: "再等等，不急。" }, { name: "没 quote 的卡" }],
    tail: "今天还行，明天早点睡。", today: { label: "撑着，但撑得住" }
  };
  const ins = spec(known);
  ["连本带利收回来。", "再等等，不急。", "今天还行，明天早点睡。", "撑着，但撑得住"]
    .forEach(q => assert.ok(ins.includes(q), "没把上一轮这句发回去：" + q));
  assert.match(ins, /一句都不许重复/);
  // 只禁字面一样是不够的——换个说法写同一个意思也是八股
  assert.match(ins, /连意思相近、换个说法的也算重复/, "只挡了逐字重复，换个说法照样能八股");
});

test("第一次翻的时候不发这一块，别凭空多一段空指令", () => {
  [null, undefined, {}, { cards: [] }, { cards: [{ name: "无 quote" }] }].forEach(k =>
    assert.ok(!/上一轮他已经说过这些/.test(spec(k)), "没有上一轮的时候不该出现这一块"));
});

test("只发句子本身，不把整份报告搬回去（健康是 ♻️，报告不跨轮累积）", () => {
  const known = {
    cards: [{ quote: "只有这句该回去。", name: "欲念起落", note: "这段观测叙述不该回去", value: "6.2",
      stats: [{ k: "实验室走廊", v: "02:15" }], week: [1, 2, 3] }],
    timeline: [{ text: "这条时间线不该回去" }], insights: [{ text: "这条洞察不该回去" }]
  };
  const block = spec(known).split("【上一轮他已经说过这些")[1] || "";
  assert.ok(block.includes("只有这句该回去。"));
  ["这段观测叙述不该回去", "这条时间线不该回去", "这条洞察不该回去", "实验室走廊", "欲念起落"]
    .forEach(x => assert.ok(!block.includes(x), "把「" + x + "」也搬回去了——健康是 ♻️，不该跨轮累积整份报告"));
});

test("别的 app 不吃这一块，而且写清楚了为什么", () => {
  const known = { cards: [{ quote: "一句话" }] };
  ["notes", "wechat", "album", "tally"].forEach(k =>
    assert.ok(!/上一轮他已经说过这些/.test(P.phoneProbeSpec(k, char, [], "", [], known).instruction),
      k + " 也吃到了健康那一块"));
  // reading 跟 health 一样是每次整份重写、也没有累积避重，但它【不该】吃这一块：
  // 书架是他这个人稳定的东西，不该每翻一次就换一整套。理由必须写在代码里，
  // 不然下一个人看到「只挂了一处」会顺手推广（见 four-surfaces-same-context.md）
  assert.ok(!/上一轮他已经说过这些/.test(P.phoneProbeSpec("reading", char, [], "", [], { shelves: [{ name: "架子" }] }).instruction));
  const why = SRC.slice(SRC.indexOf("function phoneQuoteAvoidBlock") - 900, SRC.indexOf("function phoneQuoteAvoidBlock"));
  assert.match(why, /为什么只有健康吃这一块/, "只挂一处却没写理由，下一个人会当成漏了顺手推广");
  assert.match(why, /reading/, "没说清另一个同样是 ♻️ 的 app 为什么不该吃");
});

test("quote 这一栏有判据，不是光写「他自己的一句话」", () => {
  const ins = spec(null);
  assert.match(ins, /最容易写成八股的一栏/, "没提醒这一栏容易写坏");
  assert.match(ins, /扣着这张卡今天这个读数说话/, "没要求扣着今天这个读数——不扣就会写成万能宣言");
  assert.match(ins, /换一张卡、换一天还照样成立的，就是写坏了/, "没给那条通用判据");
  assert.match(ins, /没打算给谁听/, "没说清是心里过一下的半句话，不是说给人听的");
  // 「连本带利收回来」正是这种句式：说给人听的狠话/预告
  assert.match(ins, /狠话、承诺或预告/, "没点出滑向哪一种腔调");
  assert.match(ins, /他这个人.*不是他这个类型的/, "没要求语气长成这个人，而不是这个类型");
});

test("私密那一档单独钉住占有欲宣言那条路", () => {
  const ins = spec(null);
  assert.match(ins, /【intimacy \/ desire \/ closeness 这三项】/);
  assert.match(ins, /占有欲宣言和狠话/, "私密那几项最容易滑的就是这个，没钉住");
  assert.match(ins, /那是网文腔，不是他/);
});

// 判据是【描述失败长什么样】，不是【给一句范文】——给了范文模型就照着抄
// （见 施工规则/prompt-no-content-samples.md）
test("立判据的时候没顺手塞一句范文进去", () => {
  const ins = spec(null);
  const qBlock = ins.slice(ins.indexOf("【quote 是这份报告里最容易写成八股的一栏"),
    ins.indexOf("【quote 是这份报告里最容易写成八股的一栏") + 500);
  assert.ok(qBlock.length > 50, "抠不出 quote 那一段");
  // 「如……」「比如」「例如」后面跟一句完整的话＝范文
  assert.ok(!/(比如|例如|如「)[^」\n]{6,}/.test(qBlock), "这一段里塞了范文，模型会照着那个句式抄：\n" + qBlock);
});
