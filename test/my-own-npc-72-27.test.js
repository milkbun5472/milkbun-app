// 她 2026-09-20：「宝宝能不能给我也搞可以加 npc」→「就是我关系里的 npc 比如闺蜜朋友之类的」
//   →（当轮又定）「给我自己的 npc 就让我自己写就行了，不用生成」。
//
// 配角这套本来只认「某个角色身边的人」（ownerId 指向一张角色卡）。她要的是【她自己身边的人】。
// 不另起一套存法：她在关系图 x_rels 里本来就是 "me" 这个节点（「me->某角色」一直这么存），
// 所以 ownerId 直接收 "me"，npc:true / 双向关系 / 只在群里出场，一条都不变。
// 但【怎么来的】两支不同：角色身边的人照旧一枪生成；她自己身边的人她自己写，零调用。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), screens = P("js/screens.js"), engine = P("js/engine.js");

const addMy = (() => {
  const i = app.indexOf("  const addMyNpc = (name, brief, relLabel) => {");
  assert.ok(i > 0, "抠不出 addMyNpc");
  return app.slice(i, app.indexOf("\n  };", i));
})();

test("她自己的人：她写什么就是什么，一枪都不打", () => {
  assert.ok(!/callAI|generateNpc|runProbe|await /.test(addMy), "她自己写的这一支还在调模型");
  assert.ok(/npc: true, ownerId: "me", knowsUser: true/.test(addMy),
    "落成的字段不对：要么不是配角，要么主人不是她，要么没天然认识她");
  assert.ok(/if \(!nm\) \{ toast\("先写个名字"\); return false; \}/.test(addMy), "没名字也能加一张空卡");
  // 关系图两头都写：只写一头的话，群里另一头就不认得 TA
  assert.ok(/saveRel\("me->" \+ id, note, ""\); saveRel\(id \+ "->me", note, ""\);/.test(addMy), "双向关系没建");
  assert.ok(/CharacterPronoun\.newCharacter\(/.test(addMy), "没过 newCharacter（性别那一格会缺）");
  assert.ok(/onAddMyNpc: addMyNpc,/.test(app), "没传给关系页");
});

// ⚠️「只有一处」说的是【落成什么】，不是【怎么来的】：生成那一枪整条都是
//   「拿主人的人设去编一个人」，她这一支压根不需要编，硬合成一条只会两头将就。
test("生成那一枪收回去只管角色身边的人", () => {
  assert.ok(!/opts\.mine|\{ mine: mine \}/.test(engine + app), "她那一支的开关还留在生成路上（死代码）");
  const i = engine.indexOf("async function generateNpc(p, hostChar, ask, takenNames)");
  assert.ok(i > 0, "generateNpc 的签名又长出了一个参数");
  const seg = engine.slice(i, engine.indexOf("const raw = await callAI", i));
  assert.ok(/⚠️TA不认识用户/.test(seg), "角色那一支的铁律被删了");
  const i2 = app.indexOf("  const createNpc = async (hostId, ask) => {");
  assert.ok(!/=== "me"/.test(app.slice(i2, app.indexOf("\n  };", i2))), "createNpc 里还留着她那一支");
});

test("喂给模型的那一行认得「这是她自己的人」", () => {
  const i = app.indexOf("  const npcRosterLine = (c, presentIds) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.ok(/const mine = String\(c\.ownerId\) === "me";/.test(seg), "roster 那一行不认 me");
  assert.ok(/不是谁的配角/.test(seg), "没说清她的人不是某个角色的配角");
  // ownerId 是 "me" 时 characters.find 必然落空，不许因此变成一行空话
  assert.ok(/mine \? null : characters\.find/.test(seg), "还在拿 me 去角色表里找主人");
  // 「认识她」和「知道她跟谁什么关系」是两层——她自己的人也照守
  assert.ok(/她跟在场每一位各自是什么关系，TA 一概不知道/.test(seg), "关系隐私那一层漏了");
});

test("界面按主人分两支：她自己那支是手写表单", () => {
  const i = screens.indexOf('c.meChar === "me" ? h(Fragment, null,');
  assert.ok(i > 0, "没有按主人分支");
  const seg = screens.slice(i, i + 2600);
  ["TA 叫什么", "你俩什么关系", "TA 是个什么人"].forEach(x =>
    assert.ok(seg.includes('"' + x + '"'), "手写表单少了一栏：" + x));
  assert.ok(/onAddMyNpc\(c\.npcName, c\.npcBrief, c\.npcRel\)/.test(seg), "加进来那颗没接上");
  assert.ok(!/npcBusy/.test(seg), "她这一支还挂着生成中的忙态——它根本不调模型");
  // 生成那一支原样留着
  assert.ok(/"陆闻 \/ TA的属下 \/ 她师姐"/.test(screens), "角色那一支的例子没了");
  // 她点名要去掉的那个名字
  assert.ok(!/小鱼/.test(screens), "「小鱼」还在");
  assert.ok(/\[pickCard\("me", c\.meChar === "me"/.test(screens), "她自己不在第一格");
  assert.ok(/String\(n\.ownerId\) !== "me"/.test(screens), "她自己的人还摆着那颗没意义的「跟我不认识」");
});
