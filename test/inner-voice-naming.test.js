const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GB = require("./_group-bans.js");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = require("./_online-layer.js").expand(fs.readFileSync(path.join(root, "js/app.js"), "utf8"));

// 她 2026-08-22：「心声又在『这女人』了」。和 2026-08-21 日记那次是同一个机制——
// 疏离的第三人称点评腔是【体裁自带的默认】（内心独白 / 男主角旁白），不是从人设卡来的。
// 日记那边治好了，是因为那条写得够狠：点名机制、指出去哪儿找真正的称呼、给出替代说法。
// 锚里原来那条只有一句「别用这女人那家伙」，压不住体裁惯性。

const anchor = (() => {
  const i = engine.indexOf("const PERSONA_REGISTER_ANCHOR = `");
  const start = engine.indexOf("`", i) + 1;
  return engine.slice(start, engine.indexOf("`", start));
})();

test("关键的一条：明确点名心声与内心独白，并说破这是体裁默认不是人设", () => {
  assert.match(anchor, /【心声、内心独白同样受这一条管】/);
  assert.match(anchor, /那是【体裁自带的默认】，不是你的人设/);
  assert.match(anchor, /和日记那边犯的是同一个毛病/);
  // 心里直接用「你」是正常的，别把这条读成"必须用名字"
  assert.match(anchor, /心里跟她说话时，直接用「你」也完全正常/);
});

test("六条通道都吃得到这条锚（心声在其中每一条里都会出现）", () => {
  // 四处直接注入
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "线上单聊");
  // v60.39 起三处群共用 groupBans：别再 grep「这个常量拼在那一行的哪个位置」，
  // 对着【它到底吐出哪几层】问（改拼法不该红，掉一层才该红）。
  assert.ok(GB.allGroupsHave("PERSONA_REGISTER_ANCHOR"), "三处群（线上/线下/通话）都要有");
  assert.match(engine, /OFFLINE_NARRATIVE_RUNTIME \+\n    "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "单人线下");

  // 第五处：叙事底座 → 小剧场（演出＋谢幕）与同人文穿越 RP
  assert.match(engine, /if \(opts\.register !== false\) parts\.push\(PERSONA_REGISTER_ANCHOR\);/, "叙事底座");
});

test("日记那条独立的禁令不受影响，两处各治各的体裁", () => {
  assert.match(engine, /绝不许用「这女人」「那女人」「那家伙」这类第三人称疏离说法——除非你的人设里真的就这么叫她/);
  assert.match(engine, /日记是写给自己看的，不是写给旁人做人物点评/);
});
