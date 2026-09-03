// 穿书那一屏（她 2026-09-03：「那几样选项我都是直接参考了别人的，你看看是改玩法还是咋样」）。
// 判断：「魂穿/天降」是同人圈通用词，不算抄；真正的毛病是
//   ① 「CP 左位/右位」是废话——名字代码里拿得到，而且这篇的 CP 就是她和她的角色；
//   ② 四个选项全在问【你是谁】，没有一个问【你知道多少】——而那才是穿书的乐趣。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

test("按钮上写真名，「穿成我自己」认得出是她", () => {
  const m = fic.match(/function rpModeText\([\s\S]*?\n  \}/);
  assert.ok(m, "找不到 rpModeText");
  assert.match(m[0], /c\.isMe \? "穿成我自己（" \+ c\.name \+ "）" : "穿成 " \+ c\.name/);
  // UI 真的用了它，不是留着没接
  assert.match(fic, /window\.Fanfic\.rpModeText\(m\.key, cpc\)/);
  assert.match(fic, /"你穿成谁"/);
  // 存档里那份 key 不许改名（改了旧档读不出来）
  assert.match(fic, /\{ key: "left", label: "魂穿 · CP 左位"/);
  // v60.93：正在玩的那一屏、存档行的短名也要写真名（她：「这里没改呢」）
  assert.match(fic, /function rpModeShort\(key, cpChars\)/);
  assert.match(fic, /c\.isMe \? "我自己" : c\.name/);
  assert.doesNotMatch(fic, /window\.Fanfic\.rpModeLabel\(s\.mode\)/, "还有地方在用不带名字的短名");
});

// 她 2026-09-03：「天降路人删了吧就留一个随机」
test("天降只剩「随机身份」，但 passerby 这个字留着给老存档认", () => {
  const m = fic.match(/const RP_MODES = \[[\s\S]*?\n  \];/);
  assert.ok(m, "找不到 RP_MODES");
  assert.match(m[0], /\{ key: "passerby",[^}]*legacy: true \}/, "老存档还得读得出这一档");
  assert.doesNotMatch(m[0], /\{ key: "random",[^}]*legacy/, "随机这一档不能被一起藏掉");
  // 选单按 legacy 过滤，不是把整条删掉
  assert.match(fic, /return !!m && !m\.legacy;/);
  // 提示词里仍旧认得 passerby，老局接着玩不会变味
  assert.match(fic, /if \(mode === "passerby"\) return identity && identity\.name/);
});

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
  // 另一边没有角色卡（A × 原创）时也别让人猜
  assert.match(fic, /return "穿成 原创的那位"/);
});

test("多了一维：你带着什么进去", () => {
  const m = fic.match(/const RP_KNOWS = \[[\s\S]*?\n  \];/);
  assert.ok(m, "找不到 RP_KNOWS");
  ["blank", "spoiler", "real"].forEach(k => assert.ok(m[0].indexOf('"' + k + '"') > 0, k + " 这一档没了"));
  assert.match(fic, /"你带着什么进去"/);
  // 三处都要吃到：开场、每一回合、挑降落点
  assert.match(fic, /session\.style, id, session\.know\)/, "开场没吃到");
  assert.match(fic, /session\.style, session\.playerIdentity, session\.know\)/, "回合没吃到");
  assert.match(fic, /async function genLandings\(active, fic, tab, cpChars, mode, userName, know\)/, "降落点没吃到");
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
