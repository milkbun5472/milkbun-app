// 「为什么所有人我说考试不会他们都要 offer 来帮忙看？？就算不会也要来」
// （她 2026-09-06）。
// 两件事：① 所有人出同一手（跨角色同质）；② 就算不会也要来（能力越界）。
// STOCK_REPLY_BAN 挡不住——那条把触发限定在「没什么信息量的话」，
// 「我这门考试不会」信息量很足，于是整族漏过去。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8");

test("第一道闸问的是【你真的会吗】", () => {
  const i = eng.indexOf("const OVERREACH_BAN = ");
  assert.ok(i > 0, "没有这一条");
  const rule = eng.slice(i, eng.indexOf("`;", i));
  assert.match(rule, /第一道：你真的会吗/, "没先问会不会——那就还是只在管措辞");
  assert.match(rule, /不会还揽，不是体贴，是出戏/, "没说清为什么不许揽");
  // 第二道：她那句话未必是在求助
  assert.match(rule, /第二道：她这句话是在求助吗/, "少了这一问");
  // 不许一刀切成「不许帮忙」——真会的人当然可以帮
  assert.match(rule, /帮不上忙不等于插不上话/, "切成「不许关心」了");
  assert.match(rule, /你要是真会那门东西，也得用【只有你会用的那种教法】/, "会的那些人没给出路");
  // 判据而不是内容示范（prompt-no-content-samples）
  assert.match(rule, /原样发给她手机里【另一个人】也成立/, "少了那条判据");
});

test("跟三件套同进同出——漏一处整族就回来", () => {
  // 群那三处走 groupBans
  assert.match(eng, /P\.push\(STOCK_REPLY_BAN\);\n\s*P\.push\(OVERREACH_BAN\);/, "群那一摞没跟上");
  // 单聊/线下/通话/probe 走 buildBundle
  assert.match(eng, /parts\.push\(STOCK_REPLY_BAN\);\n\s*parts\.push\(OVERREACH_BAN\);/, "buildBundle 那一处没跟上");
  // 同人文自己 push 那一串
  assert.match(fic, /if \(typeof OVERREACH_BAN !== "undefined"\) parts\.push\(OVERREACH_BAN\);/, "同人文没跟上");
});

test("代码那一半：同一【手】也算重样，不只是同一句话", () => {
  // 原来那张单子比的是逐字，而这一族每个人措辞都不一样，逐字比对一条都抓不住
  assert.match(app, /const OFFER_MOVE = \//, "没有招式那张单子");
  assert.match(app, /const crossOfferHint = charId =>/, "没接上");
  const f = new Function("return " + /const OFFER_MOVE = (\/.*?\/);/.exec(app)[1])();
  ["我帮你看看", "发我看看", "我教你", "明天我陪你弄", "要不要我帮你", "我来帮你搞"].forEach(x =>
    assert.ok(f.test(x), "这一手没认出来：" + x));
  ["今天下雨了", "你吃饭没", "我在看书"].forEach(x =>
    assert.ok(!f.test(x), "误伤了：" + x));
});

test("只看别人、不看自己；而且不禁帮忙本身", () => {
  const i = app.indexOf("const crossOfferHint = charId =>");
  const body = app.slice(i, app.indexOf("const crossSamenessHint", i));
  assert.match(body, /String\(id\) !== String\(charId\)/, "把他自己上一轮说过的也算进去了——那本来就该接得上");
  assert.match(body, /now - m\.ts <= CROSS_SAMENESS_WINDOW_MS/, "没有时间窗，攒一辈子");
  assert.match(body, /你要是真会，也换个进法/, "切成「不许帮忙」了");
  // 两条路（旧任务句 / V2 任务句）都吃得到：它并进了 crossSamenessHint
  assert.equal((app.match(/crossSamenessHint\(charId\)/g) || []).length, 2, "两条任务句没都接上");
  assert.match(app, /return tPart \+ oPart;/, "没句子重样的时候这一层就丢了");
});
