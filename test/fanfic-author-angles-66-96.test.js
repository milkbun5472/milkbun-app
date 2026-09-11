// 她 2026-09-11 拿着一屏八位太太问：「还有你看现在生成的都是一个风格的这对吗」。
// 不对。而且不是模型偷懒——是提示词里那条【按顺序列了四个格子】的写法逼出来的：
// 「偏爱什么结构、什么长度、把力气花在哪儿、又故意不写什么」，
// 于是八位太太长成同一句「偏爱X体，力气全花在Y上，坚决不写Z，全靠W定胜负」。
// 改法：格子撤掉（不是在后面挂一句「但别都一样」），换成每位一个不同的落点。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Axes = require("../js/axes.js");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
// ⚠️注释里写着这次的病历（那四个格子的原话），不 strip 的话「已经删掉了」永远断不出来
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const code = strip(fic);

const box = { Axes };
vm.createContext(box);
const a = fic.indexOf("  const PEN_AXIS = ["), b = fic.indexOf("  // 请一位太太离开名册");
assert.ok(a > 0 && b > a, "没切到掷落点那一段");
vm.runInContext(fic.slice(a, b) + "\nthis.M = { PEN_AXIS, AUTHOR_ANGLE_AXES, authorAnglesBlock, angleNonce };", box);
const M = box.M;
const nonce = i => "t" + i + ":" + (i * 7919 % 104729);

test("那四个格子是删掉了，不是在后面挂了一句「但别都一样」", () => {
  // no-yes-unless.md：话说错了就删掉重写
  assert.ok(code.indexOf("偏爱什么结构、什么长度、把力气花在哪儿") < 0, "请人那一枪的模子还在");
  assert.ok(code.indexOf("一句：偏爱什么结构、力气花在哪儿、故意不写什么") < 0, "出一批文那一枪的模子还在");
  assert.ok(code.indexOf("· bio：她是谁——写了多久、什么处境、在这个圈子里是什么位置") < 0,
    "简介那一条也是三个格子按顺序列——同一个病");
  // 撤掉之后得留下一句说人话的
  assert.match(code, /别人一眼认出她的文\*\*靠的是什么/);
});

test("两处都掷：请人那一枪和出一批文那一枪是同一层东西", () => {
  // four-surfaces-same-context.md：一层规则漏掉一处，换个入口照样一个模子印出来
  const ga = code.slice(code.indexOf("async function genAuthors"), code.indexOf("  // ---- 批量生成"));
  assert.match(ga, /authorAnglesBlock\(cnt, angleNonce\(\), "位"\)/, "请人那一页没掷落点");
  const gb = code.slice(code.indexOf("async function genBatch"), code.indexOf("const sys = buildGenSystem"));
  assert.ok(gb.length > 500, "没切到 genBatch");
  assert.match(gb, /authorAnglesBlock\(n, angleNonce\(\), "篇的那位"\)/, "出一批文那一枪没掷落点");
  // 两处都得把那个模子的形状指出来——只掷不说，模型照样可能自己排成一列
  assert.equal(code.split("全靠某物定胜负").length - 1, 2, "指出模子形状的话没在两处都说");
});

test("一批之内不许重样：撞了就往后顺一格", () => {
  for (let i = 0; i < 60; i++) {
    const txt = M.authorAnglesBlock(8, nonce(i), "位");
    M.PEN_AXIS.concat(M.AUTHOR_ANGLE_AXES).forEach(ax => {
      const got = ax.opts.filter(o => txt.split(o).length - 1 > 0)
        .map(o => [o, txt.split(o).length - 1]);
      got.forEach(([o, n]) => assert.equal(n, 1, "第 " + i + " 批里「" + o + "」出现了 " + n + " 次"));
    });
  }
});

test("格子比人少的时候认了，不许死循环也不许空着", () => {
  const txt = M.authorAnglesBlock(30, nonce(3), "位");   // 每轴只有 8 格
  assert.equal(txt.split("· 第 ").length - 1, 30);
  assert.ok(txt.indexOf("undefined") < 0 && txt.indexOf("＝null") < 0, "顺没格子了就漏出 undefined");
});

test("天花板还给模型：出口没被掷没", () => {
  let free = 0, allFree = 0;
  for (let i = 0; i < 200; i++) {
    const txt = M.authorAnglesBlock(4, nonce(i + 500), "位");
    if (txt.indexOf(Axes.FREE) >= 0) free++;
    if (txt.indexOf("剩下几样你自己挑") >= 0) allFree++;
  }
  assert.ok(free > 20, "「这一轴你自己想一个」几乎掷不到＝门关死了（" + free + "/200）");
  assert.ok(allFree > 0, "整组还回去那一档一次都没出现");
  // 请人一次最多 8 位：每条轴上的格子都得够 8 个，不然「不放回」顺不动
  M.PEN_AXIS.concat(M.AUTHOR_ANGLE_AXES).forEach(ax =>
    assert.ok(ax.opts.length >= 8, "「" + ax.zh + "」只有 " + ax.opts.length + " 格，八位就要撞"));
});

test("重按一次「请人」就该换一批落点", () => {
  // 按人数当种子的话，第二批八位会跟第一批一个角度一个角度地对上
  assert.notEqual(M.authorAnglesBlock(6, M.angleNonce(), "位"), M.authorAnglesBlock(6, M.angleNonce(), "位"));
  assert.match(String(M.angleNonce()), /^\d{10,}:/, "种子里没带时间");
  assert.notEqual(M.angleNonce(), M.angleNonce());
});

test("落点是【从哪儿下笔】，不是又一份要抄进去的设定", () => {
  const txt = M.authorAnglesBlock(3, nonce(9), "位");
  assert.match(txt, /⚠️这是【从哪儿下笔】，不是她们的设定本身——别把这几句话抄进任何一位的简介或路数里。/);
});

// ── 她 2026-09-11 第二次回来：「还是不行啊，而且全部都是太正经的了！还有这些 id 也太一样了」
//    上一版只掷了【从哪儿说起】。没掷的那两维（笔名、口气）就是它偷偷长回一个样的那两维。

test("笔名那一轴每位都掷得到：她两次报的都是这一条", () => {
  // 这一轴 skip 归零——被掷丢一次，那一位的笔名就又长回冷硬物件名了
  for (let i = 0; i < 80; i++) {
    M.authorAnglesBlock(5, nonce(i + 900), "位").split("\n")
      .filter(l => l.indexOf("· 第 ") === 0)
      .forEach(l => assert.match(l, /^· 第 \d+ 位：她这个笔名是什么样的＝/, "第 " + i + " 批有人没分到笔名那一条：" + l));
  }
});

test("笔名这一轴上有的是不正经的，也留着一格正经的", () => {
  const pen = M.PEN_AXIS[0].opts.join("｜");
  ["自嘲", "鸽子", "叠字", "英文", "中二", "吃的", "随手敲", "梗", "数字"].forEach(k =>
    assert.ok(pen.indexOf(k) >= 0, "笔名那一轴上没有「" + k + "」这一路"));
  assert.match(pen, /正经的书面词/, "一格正经的都不留＝又变成另一种一刀切");
  assert.ok(M.PEN_AXIS[0].opts.length >= 8, "格子太少，六位就要开始撞");
});

test("口气也掷：不然那一句永远是书评腔", () => {
  const tone = M.AUTHOR_ANGLE_AXES.filter(x => x.key === "tone")[0];
  assert.ok(tone, "没有口气这一轴");
  assert.ok(tone.opts.length >= 6);
  // ⚠️别写成 A|B|C：那样删掉两档也照样绿。这三路各管一种不正经，要一路一路点名
  ["挂出来吐槽", "看热闹", "不好意思地承认", "半开玩笑"].forEach(k =>
    assert.ok(tone.opts.join("｜").indexOf(k) >= 0, "口气那一轴上没有「" + k + "」这一路，剩下的都是正经的"));
  assert.match(tone.opts.join("｜"), /一本正经的作者推荐/, "一格正经的都不留");
});

test("「这是同人圈，不是文学期刊」两处都说了", () => {
  // four-surfaces-same-context：请人那一枪说了、出一批文那一枪没说，换个入口照样一屏正经
  assert.equal(code.split("这是同人圈，不是文学期刊").length - 1, 2);
  assert.equal(code.split("两三个字的冷硬物件名").length - 1, 2, "笔名都一个样这个病，只在一处写了病历");
  assert.match(code, /一批人里有一两位正经的没问题，全是正经的就不对了/, "把「正经」一刀切掉是另一种一刀切");
});

test("整组还回去的时候，笔名那一条照样在", () => {
  let hit = 0;
  for (let i = 0; i < 300 && hit < 3; i++) {
    M.authorAnglesBlock(4, nonce(i + 4000), "位").split("\n")
      .filter(l => l.indexOf("剩下几样你自己挑") > 0)
      .forEach(l => { hit++; assert.match(l, /她这个笔名是什么样的＝/, "还回去的时候把笔名也还回去了：" + l); });
  }
  assert.ok(hit > 0, "整组还回去那一档一次都没掷到");
});
