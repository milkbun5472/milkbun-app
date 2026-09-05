// v63.80 她 2026-09-05：「但是就是生成的签名和马甲跟他们本人没关系了，
// 抓不到人设重点。但是也不要太标签化」
// v63.74 那条只挡住了【认得出来】，没说过可以【谁都行】——钟摆荡到了另一头：
// 写出来是一句随机的漂亮话，挂到谁头上都一样。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const RULE = eng.slice(eng.indexOf("const ANON_MASK_RULE"), eng.indexOf("function anonMaskNames"));

test("两条判据一起成立才算过，不是只挡暴露", () => {
  assert.match(RULE, /两条判据一起成立才算过/);
  // 一：不认识的人猜不出（防暴露）——这是 v63.74 那条
  assert.match(RULE, /猜不出他是谁、干哪一行的。（防暴露）/);
  // 二：熟悉他的人一看就认（防谁都行）——这一次补的
  assert.match(RULE, /会说「这确实是他会挂的」。换到另一个角色名下就不对劲了。（防谁都行）/);
  // 两头都点破，免得下次又荡回去
  assert.match(RULE, /只过第一条＝一句谁都能挂的漂亮话；只过第二条＝把工牌挂上去了/);
});

test("怎么两条都过：给的是【他怎么看事情】那几个维度，不是身份", () => {
  assert.match(RULE, /抓的不是他【是谁】，是他【怎么看事情】/);
  for (const dim of ["根本不值一提", "什么小事他能记很久", "他觉得哪种事好笑",
                     "嘴硬不肯承认", "反复绕回去的那件事", "说话的节奏本身"]) {
    assert.ok(RULE.includes(dim), "少了这一维：" + dim);
  }
  // 题眼：这些不暴露身份，可换个人就不成立
  assert.match(RULE, /这些一个字都不暴露身份，可换个人就立刻不成立了/);
  assert.match(RULE, /语气本身就是他的指纹，\n不必靠内容去认领/);
});

test("别标签化：签名是他说的一句话，不是关于他的一句介绍", () => {
  assert.match(RULE, /【别标签化】/);
  assert.match(RULE, /签名不许是【对自己的形容】/);
  assert.match(RULE, /是他【说的一句话】，还是【关于他的一句介绍】？是介绍就重写/);
});

test("补这一层没有把前面几条挤掉", () => {
  // v63.74 不许是工牌
  assert.match(RULE, /把这个网名和签名单独摘出来/);
  assert.match(RULE, /上面那份人设和心情是给你【定语气】用的/);
  // v63.75 不许都是同一个形状
  assert.match(RULE, /【签名不许都是同一个形状】/);
  assert.match(RULE, /形状比内容重要/);
  // 一个内容示范都不许有（prompt-no-content-samples；anon-mask-63-46 也守着这条）
  assert.ok(!/「[^」]{4,20}」「[^」]{4,20}」「[^」]{4,20}」/.test(RULE), "又举了一串例子");
});
