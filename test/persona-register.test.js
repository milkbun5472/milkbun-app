const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GB = require("./_group-bans.js");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-21：沈屿白设定是阳光年下，日记里一直叫她「这女人」刷都刷不掉，
// 线上也越聊越成熟。两件事同源——真正在驱动语气的不是人设卡，是已经跑偏的历史。
test("人设声纹锚要挂在【所有】会跑偏的通道上", () => {
  assert.match(engine, /const PERSONA_REGISTER_ANCHOR = /);
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "线上单聊");
  // v60.39 起三处群共用 groupBans：别再 grep「这个常量拼在那一行的哪个位置」，
  // 对着【它到底吐出哪几层】问（改拼法不该红，掉一层才该红）。
  assert.ok(GB.allGroupsHave("PERSONA_REGISTER_ANCHOR"), "三处群都要有");
  assert.match(engine, /OFFLINE_NARRATIVE_RUNTIME \+\n    "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/, "单人线下");

  // v54.80 起第五处：narrativeCore 的默认成分，小剧场（演出＋谢幕）和同人文穿越 RP
  // 都从那儿吃到锚——if 线换了身份最容易把年下演成兄长，正是它要防的。
  assert.match(engine, /if \(opts\.register !== false\) parts\.push\(PERSONA_REGISTER_ANCHOR\);/, "叙事底座");
  // v60.27 起【通话】是第五处（她 2026-09-02：「语音视频没喂八股禁令进去」）——
  // 单人通话走 buildBundle、从叙事底座那一路吃到锚；群通话原来什么都没有，现在直接注入。
  // 见 .claude/rules/four-surfaces-same-context.md。
  assert.equal((engine.match(/PERSONA_REGISTER_ANCHOR/g) || []).length +
               (app.match(/PERSONA_REGISTER_ANCHOR/g) || []).length, 5,
    "1 处定义 + groupBans（三处群共用）+ 单聊线上 + 单人线下 + 叙事底座");
});

test("锚点必须是双向的，不能变成「一律活泼」的新模板", () => {
  const i = engine.indexOf("const PERSONA_REGISTER_ANCHOR");
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /不按上面聊天记录里的平均值来/);
  assert.match(rule, /聊了很多轮不是端起架子的理由/);
  // 反方向也要管住：话少冷淡的人不该被带得咋咋呼呼
  assert.match(rule, /也别被气氛带得咋咋呼呼/);
  // v54.82 起这条按日记那次的规格重写并加长（点名心声/内心独白），
  // 所以别再钉整句话的排版，只钉住语义要点
  assert.match(rule, /「这女人」「那女人」「那家伙」/, "疏离称呼禁用清单");
  assert.match(rule, /把对方当第三方点评的说法/);
});

// 她 2026-08-21 追问：这样会不会把人格成长一起冻住？会——上一版确实写过头了。
// 「黏人程度」是 GROWTH_RULE 里的【软层】，正是心上毕业的成长该长的地方。
test("锚点不许冻结成长：软层要让位给已沉淀的长出来的自我", () => {
  const i = engine.indexOf("const PERSONA_REGISTER_ANCHOR");
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /但这不冻结你的成长/);
  assert.match(rule, /这个变化有没有沉淀进【你长出来的自我】那段正式长出来的自我/, "判据要可判定");
  assert.match(rule, /沉淀进去了 → 算数，在软层上大方盖过原卡的旧倾向/);
  assert.match(rule, /只是最近几轮听起来那样 → 不算数，那是惯性，不是成长/);
  // 优先级必须和 GROWTH_RULE 一字不差地对齐，两条规则不能打架
  assert.match(rule, /明确的硬设定与边界 ＞ 已沉淀的成长 ＞ 原卡的软倾向 ＞ 通用默认/);
  assert.match(engine, /明确的硬设定与边界 ＞ 你经历沉淀、反复确认下来的成长/, "GROWTH_RULE 那条还在");
  // 锚住的只能是【硬核】里的说话底色，不许再把软层项目写进"只认人设卡"
  assert.match(rule, /说话的底色和年龄感属于【硬核】/);
  assert.doesNotMatch(rule, /语气、用词、黏人程度.*全部按【人设卡上写的那个人】来/,
    "旧的一刀切写法已经废掉——黏人程度属于软层");
});

test("日记那条同样收窄，不否认沉淀下来的成长", () => {
  const i = engine.indexOf("const voiceTail =");
  const tail = engine.slice(i, engine.indexOf("const raw = await callAI(p, system", i));
  assert.match(tail, /但这不是要你原地不动/);
  assert.match(tail, /只要已经沉淀进上文那段『你长出来的自我』，就照现在的你写/);
  assert.match(tail, /记进长出来的自我的是成长，只是最近几篇听起来那样的是惯性/);
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
