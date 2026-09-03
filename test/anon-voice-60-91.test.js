const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-03：「匿名问答角色回答感觉很容易被压成标签，
// 你看看要不要像小游戏那样可以注入当下心情和最近聊天」。
// 查下来料一直是够的——匿名箱走 ctxFor(char)，心情、最近对话、印象卡、好感都在 bundle 里。
// 错的是【站的位置】：runProbe 开场白把模型按在分析师的椅子上
//（「不要扮演角色对话，冷静推演」），那张椅子上写出来的必然是判词体。
// 这是 four-surfaces-same-context 里 v55.91 那一条的又一次复发：喂的不只是料，还有站位。

test("runProbe 多一档【本人在打字】的站位，默认那档一个字没动", () => {
  assert.match(engine, /const head = probe\.voice\n?\s*\? "你就是「" \+ \(\(ctx\.char && ctx\.char\.name\) \|\| "TA"\) \+ "」本人。/);
  assert.match(engine, /你不是在分析这个人，你【就是】这个人，正拿着手机打字。/);
  // 绝大多数推演（行程/钱包/相册/书架）本来就该坐分析师那把椅子
  assert.match(engine, /: "你是角色状态推演引擎。不要扮演角色对话，而是基于背景冷静推演，严格输出 JSON。";/);
  // 料一个字不少：两档共用同一个 bundle
  assert.match(engine, /const system = head \+ "\\n\\n" \+ buildBundle\(ctx\)/);
  assert.match(engine, /\【" \+ \(probe\.voice \? "这一次要写什么" : "推演任务"\) \+ "\】/);
});

test("匿名箱两条路都换成本人站位", () => {
  const box = app.slice(app.indexOf("const openAnonBox = async char =>"), app.indexOf("const askAnon = async (char, q)"));
  const one = app.slice(app.indexOf("const askAnon = async (char, q)"), app.indexOf("const askAnon = async (char, q)") + 2200);
  assert.match(box, /voice: true,/, "一次答一箱那条路");
  assert.match(one, /voice: true,/, "手机里随手问一句那条路");
  // 站位换了，人称也得跟着换——「他」是分析师的说法
  assert.ok(box.indexOf('"「" + char.name + "」(网名:" + nn + ")打开了') < 0, "指令里还在用第三人称说他");
  assert.match(box, /"你\(网名:" \+ nn \+ "\)打开了自己的匿名箱/);
});

test("不许答成一台判词机器：长短、不下结论、心情、说人话", () => {
  const box = app.slice(app.indexOf("const openAnonBox = async char =>"), app.indexOf("const askAnon = async (char, q)"));
  assert.match(box, /别把自己答成一台判词机器/);
  assert.match(box, /长短要不一样/, "每条一样长就是标签化最明显的样子");
  assert.match(box, /绝不许每条都是同样长度、同样节奏的一句陈述句/);
  assert.match(box, /不是每条都要盖章定性/);
  assert.match(box, /你此刻的心情写在上面/, "心情就在 bundle 里，得让它真的影响这几条");
  assert.match(box, /别用『其实\/本质上\/无非是』这种给人上课的开场/);
});

test("匿名箱照旧不许知道问的是谁", () => {
  const one = app.slice(app.indexOf("const askAnon = async (char, q)"), app.indexOf("const askAnon = async (char, q)") + 2200);
  assert.match(one, /你不知道问的其实是/, "这一层是这个玩法的根，不许在改口吻时弄丢");
  const box = app.slice(app.indexOf("const openAnonBox = async char =>"), app.indexOf("const askAnon = async (char, q)"));
  assert.match(box, /你不知道这人是谁/);
  assert.match(box, /把那个念头写进 guess/, "猜错人那一档也得留着");
});
