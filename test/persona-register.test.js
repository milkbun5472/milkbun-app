const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-21：沈屿白设定是阳光年下，日记里一直叫她「这女人」刷都刷不掉，
// 线上也越聊越成熟。两件事同源——真正在驱动语气的不是人设卡，是已经跑偏的历史。
test("人设声纹锚要挂在【所有】会跑偏的通道上", () => {
  assert.match(engine, /const PERSONA_REGISTER_ANCHOR = /);
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "线上单聊");
  assert.match(app, /REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR \+ "\\n\\n" \+ dir \+ common/, "线上群聊");
  assert.match(engine, /OFFLINE_NARRATIVE_RUNTIME \+\n    "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "单人线下");
  assert.match(engine, /REGISTER_FOLLOWS_SCENE \+\n    "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "群线下");
  // 四条通道一个都不能漏，漏哪条哪条就继续老成下去
  assert.equal((engine.match(/PERSONA_REGISTER_ANCHOR/g) || []).length +
               (app.match(/PERSONA_REGISTER_ANCHOR/g) || []).length, 5, "1 处定义 + 4 处注入");
});

test("锚点必须是双向的，不能变成「一律活泼」的新模板", () => {
  const i = engine.indexOf("const PERSONA_REGISTER_ANCHOR");
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /只认人设卡/);
  assert.match(rule, /别因为聊了很多轮就自动端起一副沉稳老练的口吻/);
  assert.match(rule, /惯性不是理由/);
  // 反方向也要管住：话少冷淡的人不该被带得咋咋呼呼
  assert.match(rule, /人设写的是话少、冷淡、端着的，就别被气氛带得咋咋呼呼/);
  assert.match(rule, /别用「这女人」「那家伙」这类把对方当第三方点评的说法/);
});

test("日记：上一篇只借鉴「事」，措辞和称呼不许传下去", () => {
  assert.match(engine, /它只用来避开重复的【事】：里面的措辞、语气、以及他称呼对方的说法，一律【不作数】/);
  assert.match(engine, /上一篇要是把人叫岔了、腔调写老了，今天不许跟着错下去/);
});

test("日记落笔守则要管称呼和年龄感，而且放在 recency 最强的位置", () => {
  const i = engine.indexOf("const voiceTail =");
  const tail = engine.slice(i, engine.indexOf("const raw = await callAI(p, system", i));
  assert.match(tail, /〔怎么称呼她〕/);
  assert.match(tail, /绝不许用「这女人」「那女人」「那家伙」/);
  assert.match(tail, /除非你的人设里真的就这么叫她/, "不能一刀切——有的角色人设就是这么叫");
  assert.match(tail, /〔年龄与语域〕/);
  assert.match(tail, /别因为『在写日记』就自动端起一副沉稳老练的口吻/);
  assert.match(tail, /以往的日记若已经写得比你本人老成，那是走偏了，今天纠回来/);
  // voiceTail 必须仍然挂在 user 消息上（system 中间那个位置压不住）
  assert.match(engine, /content: \(retro \? "现在是今晚睡前[^)]*\) \+ voiceTail/);
  // 声纹样本从 2 条加到 5 条：日记要靠它定调，两条太薄
  assert.match(tail, /voiceSamples\.slice\(-5\)/);
});
