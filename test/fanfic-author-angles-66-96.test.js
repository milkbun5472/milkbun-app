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
const a = fic.indexOf("  const AUTHOR_ANGLE_AXES"), b = fic.indexOf("  // 请一位太太离开名册");
assert.ok(a > 0 && b > a, "没切到掷落点那一段");
vm.runInContext(fic.slice(a, b) + "\nthis.M = { AUTHOR_ANGLE_AXES, authorAnglesBlock, angleNonce };", box);
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
    M.AUTHOR_ANGLE_AXES.forEach(ax => {
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
    if (txt.indexOf("落点你自己挑一个") >= 0) allFree++;
  }
  assert.ok(free > 20, "「这一轴你自己想一个」几乎掷不到＝门关死了（" + free + "/200）");
  assert.ok(allFree > 0, "整组还回去那一档一次都没出现");
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
