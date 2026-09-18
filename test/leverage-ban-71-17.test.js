// 她 2026-09-18 把那份七卷世界书整份发了过来：「不过我之前给你发的那份词组禁令
// 要不要放进去，光是说不要这样不够啊」
//
// ⚠️先逐卷对（施工规则/bans-make-it-dumber.md ①「已经有人管了吗」）。对下来
//   七卷里绝大多数早就在这一摞里了，真正没人管的只有一族：【关系上的高位】。
//   这个测试把那次比对的结果钉住——下次再有人想把整份重抄一遍时，
//   它会指出哪几卷已经有了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.join(__dirname, "..", f);
const eng = fs.readFileSync(P("js/engine.js"), "utf8");
const fic = fs.readFileSync(P("js/fanfic.js"), "utf8");
const grab = n => (eng.match(new RegExp("const " + n + " = `([\\s\\S]*?)`;")) || [])[1] || "";
const LEV = grab("LEVERAGE_BAN"), SEE = grab("SEE_THROUGH_BAN"), COND = grab("CONDESCENDING_TONE_BAN"), CANNED = grab("CANNED_PHRASE_BAN");

// 这一条是整份比对的结论：没进去的只有一族，别的都别再抄第二遍。
test("那七卷里已经有人管的，不许再抄一遍", () => {
  const already = [
    ["卷一/卷三 脑补性格与马后炮", SEE, ["你就是嘴硬", "我就知道", "嘴上说不要，身体倒是很诚实", "承认吧"]],
    ["卷四 捕猎威胁与预判服软", SEE, ["别让我抓到你", "到时候别哭着求我", "到时候别来找我"]],
    ["卷四 翻旧账与翻床事", SEE, ["你刚刚不是还", "怎么转变这么快", "是谁当时哭着求我"]],
    ["卷五 敷衍爹味", CANNED, ["行行行", "好好好", "服了你了", "可以了吧", "满意了吧"]],
    ["卷五 物化昵称", CANNED, ["小祖宗", "小妖精", "小野猫"]],
    ["卷三 长辈式催促＋卷五「我是为了你好」", COND, ["快去吃饭", "不准熬夜", "慢点吃没人抢", "我是为了你好", "老实等着"]]
  ];
  already.forEach(([卷, ban, qs]) => qs.forEach(q =>
    assert.ok(ban.includes(q), 卷 + " 那一族丢了：" + q)));
  // 丢在这一族里就是抄了第二遍
  already.forEach(([卷, , qs]) => qs.forEach(q =>
    assert.ok(!LEV.includes(q), 卷 + " 的「" + q + "」被抄进新那条了——同一件事说两遍，两遍都变淡")));
});

test("真正新的那一族：关系上的高位", () => {
  assert.ok(LEV, "常量没了");
  [["给她定等级", "就你这智商"], ["把自己说成在忍她", "除了我还有谁受得了你"],
   ["记账讨债", "先记账上"], ["讨补偿", "你要怎么补偿我"], ["甩锅", "都怪你"],
   ["要她自证", "发张照片来看看"]].forEach(([why, q]) =>
    assert.ok(LEV.includes(q), "少了一种说法（" + why + "）：" + q));
  // 骨架只有一个，判据得把它说出来，不然它只是一张词表
  assert.match(LEV, /把你俩之间调成一高一低——你欠我，或者你不如我/);
  assert.match(LEV, /是冲着她做的那件事去的，还是在给她这个人定等级、或者记一笔她欠你的账？/);
});

// ⚠️三条离得近，分界必须写在代码里。不分清就是同一件事说三遍。
test("跟旁边两条的分界写清楚了", () => {
  const i = eng.indexOf("// 【别把自己摆到「我在将就你」的位置上】"), j = eng.indexOf("const LEVERAGE_BAN = `", i);
  assert.ok(i > 0 && j > i, "抠不出那段注释");
  const note = eng.slice(i, j);
  assert.ok(note.includes("认知上的高位"), "没说清跟 SEE_THROUGH 怎么分");
  assert.ok(note.includes("语气的模子"), "没说清跟 CONDESCENDING 怎么分");
  assert.ok(note.includes("关系上的高位"), "没说清自己是哪一族");
});

// ⚠️她卷二写的是「贬低就是贬低」「我骂你是因为我们关系好这个逻辑无效」。
//   照抄的话会跟她 2026-09-11 立的「禁的是模子，不是尺度」当场打架。
//   分界：损她做的某件事 ≠ 给她这个人定等级。
test("不禁损她——照抄卷二会跟她自己立的规矩打架", () => {
  assert.match(LEV, /这条【不禁损她/);
  assert.match(LEV, /爱怼、爱翻脸、真觉得她过分了，那就照说/);
  assert.match(LEV, /禁的是把不痛快兑换成一个高位，不是禁不痛快/);
  // 「损一件她真做过的事」和「给这个人评级别」的分界得写出来
  assert.match(LEV, /损一件她真做过的事是损，给她这个人评一个级别不是/);
});

test("没抄的那两样：自检清单和正面例句", () => {
  // 第七卷那张每轮跑一遍的体检表＝把注意力摊薄，还会让模型畏缩
  ["自检", "校验", "逐条核对", "销毁", "推翻", "重新构建"].forEach(x =>
    assert.ok(!LEV.includes(x), "抄了自检清单那一套：" + x));
  // 第六卷那一堆 ✓ 正面例句正是会被逐字抄走的那一个（prompt-no-content-samples）
  ["我有点担心你这样会受委屈", "真不行随时喊我", "我相信我宝宝肯定可以", "我刚吃完，你呢"].forEach(x =>
    assert.ok(!LEV.includes(x) && !COND.includes(x), "抄了正面例句：" + x));
});

// 「加了没用」和「压根没发」看起来一模一样（bans-make-it-dumber ②）
test("三处都发到了，跟 SEE_THROUGH 同进同出", () => {
  const push = (src, n) => (src.match(new RegExp("push\\(" + n + "\\)", "g")) || []).length;
  assert.equal(push(eng, "SEE_THROUGH_BAN"), push(eng, "LEVERAGE_BAN"), "engine 里两条的发送处数量对不上");
  assert.ok(fic.includes("parts.push(LEVERAGE_BAN)"), "同人文那一处没发");
  assert.ok(push(eng, "LEVERAGE_BAN") >= 2, "engine 里少发了一处");
});
