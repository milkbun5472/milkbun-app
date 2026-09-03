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
