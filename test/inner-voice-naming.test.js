const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「心声又在『这女人』了」。和 2026-08-21 日记那次是同一个机制——
// 疏离的第三人称点评腔是【体裁自带的默认】（内心独白 / 男主角旁白），不是从人设卡来的。
// 日记那边治好了，是因为那条写得够狠：点名机制、指出去哪儿找真正的称呼、给出替代说法。
// 锚里原来那条只有一句「别用这女人那家伙」，压不住体裁惯性。

const anchor = (() => {
  const i = engine.indexOf("const PERSONA_REGISTER_ANCHOR = `");
  const start = engine.indexOf("`", i) + 1;
  return engine.slice(start, engine.indexOf("`", start));
})();

test("称呼那条按日记的规格重写：给出替代、点名体裁、留人设例外", () => {
  // ① 去哪儿找真正的称呼 + 具体替代
  assert.match(anchor, /看你自己刚才说过的话里是怎么叫她的：名字、昵称、还是直接「你」/);
  // ② 禁用清单要盖住同族说法，只禁一个它就换一个
  ["这女人", "那女人", "那家伙", "这丫头", "这小东西"].forEach(w =>
    assert.ok(anchor.includes(w), "疏离称呼禁用清单里少了：" + w));
  // ③ 人设里真这么叫的角色不能被误伤
  assert.match(anchor, /除非你的人设里真的就这么叫她/);
});

test("关键的一条：明确点名心声与内心独白，并说破这是体裁默认不是人设", () => {
  assert.match(anchor, /【心声、内心独白同样受这一条管】/);
  assert.match(anchor, /那是【体裁自带的默认】，不是你的人设/);
  assert.match(anchor, /和日记那边犯的是同一个毛病/);
  // 心里直接用「你」是正常的，别把这条读成"必须用名字"
  assert.match(anchor, /心里跟她说话时，直接用「你」也完全正常/);
});

test("字段说明本地也补一句：action 有人称硬规则，thought 不能缺", () => {
  // action 那条一直都在，thought 这条是新补的对称规则
  assert.match(app, /必须用第一人称「我」写，禁止用角色名或「他／她／TA」从旁描述/, "action 的人称规则还在");
  assert.match(app, /心声里怎么称呼她，用你平时真的用的那个（名字、昵称、或者直接「你」）/);
  assert.match(app, /那是内心戏体裁自带的默认，不是你的人设/);
  // 群聊那条也要有
  assert.match(app, /心里怎么称呼别人就用平时那个称呼，别写成「这女人」「那家伙」这类旁观点评腔/);
});

test("六条通道都吃得到这条锚（心声在其中每一条里都会出现）", () => {
  // 四处直接注入
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "线上单聊");
  assert.match(app, /REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR \+ "\\n\\n" \+ dir \+ common/, "线上群聊");
  assert.match(engine, /OFFLINE_NARRATIVE_RUNTIME \+\n    "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "单人线下");
  assert.match(engine, /REGISTER_FOLLOWS_SCENE \+\n    "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "群线下");
  // 第五处：叙事底座 → 小剧场（演出＋谢幕）与同人文穿越 RP
  assert.match(engine, /if \(opts\.register !== false\) parts\.push\(PERSONA_REGISTER_ANCHOR\);/, "叙事底座");
});

test("日记那条独立的禁令不受影响，两处各治各的体裁", () => {
  assert.match(engine, /绝不许用「这女人」「那女人」「那家伙」这类第三人称疏离说法——除非你的人设里真的就这么叫她/);
  assert.match(engine, /日记是写给自己看的，不是写给旁人做人物点评/);
});
