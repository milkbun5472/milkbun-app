// 朋友圈的外语翻译（她 2026-10-03）
//
// 她原话：「朋友圈也搞个外语翻译吧，设置跟着聊天设置走，如果开了自动翻译
//          生成的时候带上，然后还有免费的兜底」。
//
// 三件事，一件都不许少：
//   ① 不新开开关——读的就是这个人聊天设置里那一格 bilingual（家规 minimize-toggles）。
//   ② 开着就在【同一次生成】里把译文一起要回来（不额外花一次钱），存进这一条的 zh。
//   ③ 没开、或者模型没给：气泡上那颗「译」照旧点得动，走免费优先那条链
//      （translateToZh：Google → MyMemory → 后台线路）。
//
// 渲染只走 TransText——全库唯一那条正文渲染路，免费兜底和「自动展开译文」
// 都长在它身上，朋友圈接上去就等于两样一起有了（施工规则/one-public-mechanism）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");
const live = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const GEN = (() => {
  const i = live(app).indexOf("const genMoment = async char =>");
  const j = live(app).indexOf("const momentGenImage", i);
  assert.ok(i > 0 && j > i, "抠不出 genMoment");
  return live(app).slice(i, j);
})();

test("① 跟着聊天设置那一格走，不另开开关", () => {
  assert.match(GEN, /const _momBi = !!\(settingsFor\(char\.id\) \|\| \{\}\)\.bilingual;/,
    "没读这个人聊天设置里的「外语中译」");
  assert.ok(!/x_momentAutoZh|x_momZh/.test(app), "又给朋友圈单开了一个翻译开关");
});

test("② 开着才要译文，而且是同一次调用里要", () => {
  assert.match(GEN, /_momBi\s*\n?\s*\? "\\n\\n【这条朋友圈要带中译】/, "没把要译文那段挂上去");
  assert.match(GEN, /instruction:[\s\S]*_momBiSpec/, "那段没真发进 instruction");
  // 两支 schemaHint（配图开着/关着）都得有 zh，漏一支就是「某些角色永远没译文」
  // 2 → 4（她 2026-10-03 第二轮：「朋友圈评论的外语能不能也翻译了」）：
  //   两支 schemaHint（配图开着/关着）× 两处（正文的 zh + 每条评论自己的 zh）。
  const hints = [...GEN.matchAll(/_momBi \? ",\\"zh\\":/g)];
  assert.equal(hints.length, 4, "schemaHint 里 zh 只加了 " + hints.length + " 处（要正文 + 评论各两支）");
  assert.match(GEN, /这条评论的中译或null/, "评论那一格没要译文");
  assert.match(GEN, /不是中文的那几条也各自给一份中译/, "没跟模型说评论也要译");
  assert.ok(!/"zh":\\"正文的中译/.test(GEN.replace(/_momBi \? [^:]*:/g, "")),
    "没开的时候也在要译文，等于白给模型加活");
});

test("③ 没给就不存那一格，存的也要是真有字的", () => {
  assert.match(GEN, /_momBi && d\.zh && String\(d\.zh\)\.toLowerCase\(\) !== "null" && String\(d\.zh\)\.trim\(\)/,
    "模型填了字符串 \"null\" 或空白也会被当成译文存下来");
});

test("④ 三处朋友圈正文都走 TransText，免费兜底跟着一起来", () => {
  const feed = live(comp).slice(live(comp).indexOf("function MomentsFeed({"), live(comp).indexOf("function MomentsProfile("));
  const prof = live(comp).slice(live(comp).indexOf("function MomentsProfile("));
  assert.match(feed, /h\(TransText, \{ text: m\.content, zhReady: m\.zh \}\)/, "列表那条没走");
  assert.equal((prof.match(/h\(TransText, \{ text: m\.content, zhReady: m\.zh \}\)/g) || []).length, 2,
    "个人页那两处（正文 + 另一处）没都走");
  // 兜底链本身还在：译不出来别只报最后一条原因
  const eng = fs.readFileSync("js/engine.js", "utf8");
  assert.match(eng, /\{ by: "免费", run: \(\) => _transGoogle/, "免费第一顺位没了");
  assert.match(eng, /\{ by: "模型", run: \(\) => opts && opts\.noModel \? Promise\.reject\(new Error\("[^"]*"\)\) : _transModel/, "最后那级兜底没了");
});
