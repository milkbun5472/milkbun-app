// 穿书那一屏（她 2026-09-03：「那几样选项我都是直接参考了别人的，你看看是改玩法还是咋样」）。
// 判断：「魂穿/天降」是同人圈通用词，不算抄；真正的毛病是
//   ① 「CP 左位/右位」是废话——名字代码里拿得到，而且这篇的 CP 就是她和她的角色；
//   ② 四个选项全在问【你是谁】，没有一个问【你知道多少】——而那才是穿书的乐趣。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");
// ⚠️v67.02：**「魂穿」整套删掉了**（她 2026-09-11：「加笔本来就不应该有魂穿这种东西，
//   那是以前的玩法现在应该删掉了」）。所以原来钉 RP_MODES／rpModeShort 的那两条
//   跟着删了——功能没了，断言不留（不是改成断言它不存在）。
//   下面留着的是【跟模式无关】的那几条：老局的 know 那一路、平行时空那条线。

// 她 2026-09-03：「同人文确实能写两个角色之间的，所以不一定是我自己」
test("CP 是两个角色时，那几句话照样成立", () => {
  const m = fic.match(/function rpKnowLine\([\s\S]*?\n  \}/);
  assert.ok(m, "找不到 rpKnowLine");
  // 分两种局面写：她在 CP 里 / 她不在
  assert.match(m[0], /const mine = \(cpChars \|\| \[\]\)\.filter\(function \(c\) \{ return c && c\.isMe; \}\)\[0\]/);
  assert.match(m[0], /一边记得、一边不记得/, "她在 CP 里那一支");
  assert.match(m[0], /我认识你们，你们不认识我/, "她不在 CP 里那一支");
  // 选项说明本身也不许写死成「你和 TA 的关系」
  const k = fic.match(/const RP_KNOWS = \[[\s\S]*?\n  \];/)[0];
  assert.doesNotMatch(k, /你和 TA 真正的关系/);
  assert.match(k, /你记得现实里的他们/);
});

// v63.92 起选单里不再问这一维，但【已经开着的那几局】存档里写着 know——
// 撤掉一道选择不该反过来改掉正在玩的局，所以读那一栏的那几条链一条都不许断。
test("老局的 know 照旧一路发到底", () => {
  const m = fic.match(/const RP_KNOWS = \[[\s\S]*?\n  \];/);
  assert.ok(m, "找不到 RP_KNOWS");
  ["blank", "spoiler", "real"].forEach(k => assert.ok(m[0].indexOf('"' + k + '"') > 0, k + " 这一档没了"));
  assert.equal(fic.split("buildRPSystem(fic, tab, cpChars, userName, worldbook, session.style, session.know)").length - 1, 3,
    "开场／回合／收尾三处，少一处那一局的 know 就半路断了");
});

test("老存档不受影响：没有 know 的那些一个字都不多发", () => {
  const m = fic.match(/function rpKnowLine\([\s\S]*?\n  \}/);
  assert.ok(m, "找不到 rpKnowLine");
  assert.match(m[0], /if \(!k \|\| k\.key === "blank"\) return "";/);
});

test("平行时空那条线没被越过：带记忆≠去翻主线记忆库", () => {
  const m = fic.match(/function rpKnowLine\([\s\S]*?\n  \}/);
  assert.match(m[0], /不许直接引用现实里发生过的具体事件当剧情/);
  assert.match(m[0], /只有玩家自己心里记得/);
  // 带剧透那一档也不许引擎替玩家把剧透说出来
  assert.match(m[0], /你不许替玩家把剧透说出来/);
});
