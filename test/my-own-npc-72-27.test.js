// 她 2026-09-20：「宝宝能不能给我也搞可以加 npc」→「就是我关系里的 npc 比如闺蜜朋友之类的」。
//
// 配角这套本来只认「某个角色身边的人」（ownerId 指向一张角色卡）。她要的是【她自己身边的人】。
// 不另起一套：她在关系图 x_rels 里本来就是 "me" 这个节点（「me->某角色」一直是这么存的），
// 所以 ownerId 直接收 "me"，npc:true / 双向关系 / 只在群里出场，一条都不变。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), screens = P("js/screens.js"), engine = P("js/engine.js");

const createNpc = (() => {
  const i = app.indexOf("  const createNpc = async (hostId, ask) => {");
  assert.ok(i > 0, "抠不出 createNpc");
  return app.slice(i, app.indexOf("\n  };", i));
})();

test("主人可以是她自己，而且走的是同一条路", () => {
  assert.ok(/const mine = String\(hostId\) === "me";/.test(createNpc), "不认 me 这个主人");
  assert.ok(/name: userName\(profile\), persona: String\(\(profile && profile\.persona\) \|\| ""\)/.test(createNpc),
    "她这一支没拿她自己的人设去生成");
  // 同一条路：npc:true / ownerId / 双向关系一条都不另写
  assert.ok(/npc: true, ownerId: hostId/.test(createNpc), "又给她的人另起了一套字段");
  assert.ok(/saveRel\(hostId \+ "->" \+ id/.test(createNpc) && /saveRel\(id \+ "->" \+ hostId/.test(createNpc),
    "双向关系没建（她那一支就成了群里互不认识）");
});

// ⚠️她自己的人认识她是前提，不该还要她去点那颗「也认识我」
test("她自己的人天然认识她，角色那边仍旧默认不认识", () => {
  assert.ok(/mine \? \{ knowsUser: true, knowsUserNote:/.test(createNpc), "她的人没自动标成认识她");
  assert.ok(/: null\)\)\]\);/.test(createNpc), "角色那一支被顺手改成默认认识了——多数配角确实不认识她");
  assert.ok(/String\(n\.ownerId\) !== "me"/.test(screens), "她自己的人还摆着那颗没意义的「跟我不认识」");
});

// ⚠️生成那一枪原来写死「TA不认识用户，绝不许写任何关于用户的事」——她这一支必须反过来
test("生成提示词按主人是谁分叉，但关系隐私两边都守住", () => {
  const i = engine.indexOf("async function generateNpc(p, hostChar, ask, takenNames, opts) {");
  assert.ok(i > 0, "generateNpc 没接住那面旗子");
  const seg = engine.slice(i, engine.indexOf("\n}", engine.indexOf("const raw = await callAI", i)));
  assert.ok(/const mine = !!\(opts && opts\.mine\);/.test(seg), "没读那面旗子");
  assert.ok(/TA 认识用户本人/.test(seg), "她这一支还在说 TA 不认识她");
  assert.ok(/⚠️TA不认识用户/.test(seg), "角色那一支那条铁律被删了");
  // 认识她 ≠ 知道她跟角色们的事：两支都得守
  assert.ok(/一概不知道，简介里一个字都不许提到那些角色/.test(seg), "她这一支漏了关系隐私");
  assert.ok(/不许给 TA 安排暗恋用户/.test(seg), "她这一支没拦住把闺蜜写成暧昧对象");
  assert.ok(/generateNpc\(p, host, ask, npcsOf\(hostId\)\.map\(c => c\.name\), \{ mine: mine \}\)/.test(app),
    "调用方没把旗子传下去");
});

test("喂给模型的那一行认得「这是她自己的人」", () => {
  const i = app.indexOf("  const npcRosterLine = (c, presentIds) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.ok(/const mine = String\(c\.ownerId\) === "me";/.test(seg), "roster 那一行不认 me");
  assert.ok(/不是谁的配角/.test(seg), "没说清她的人不是某个角色的配角");
  // ownerId 是 "me" 时 characters.find 必然落空，不许因此变成一行空话
  assert.ok(/mine \? null : characters\.find/.test(seg), "还在拿 me 去角色表里找主人");
});

test("挑主人那一格第一张是她自己", () => {
  const i = screens.indexOf('h(Eyebrow, { style: { marginBottom: 10 } }, "算在谁身边")');
  assert.ok(i > 0, "抠不出「算在谁身边」");
  const seg = screens.slice(i, i + 700);
  assert.ok(/\[pickCard\("me", c\.meChar === "me"/.test(seg), "她自己不在第一格");
  // me 是一个名字字符串、不是一张卡：头像读 profile、名字读 me，弄反了就是一张空白头像
  assert.ok(/const ch = id === "me" \? profile : characters\.find/.test(screens), "她那张卡的头像读错了地方");
  assert.ok(/id === "me" \? \(me \|\| "我"\) \+ "（我自己）"/.test(screens), "她那张卡的名字读错了地方");
  assert.ok(/我闺蜜小鱼 \/ 我同事 \/ 我表妹/.test(screens), "选了她自己之后，例子还在教她写角色的属下");
});
