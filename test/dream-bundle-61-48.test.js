// v61.48 她 2026-09-04 四件事：
//   1 解梦条目收不起来，一条很长就要翻好久 → 折叠
//   2 「保证解梦和做梦都喂 bundle 进去」→ 做梦（dream.js）也要喂
//   3 「母题点了没动静」→ 面板只画在【她的梦】那一栏里，站在别的栏点当然没反应
//   4 梦签攒成一册；看过他们的梦之后，让那点余味轻轻进他的上下文（不做卡片）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const dj = fs.readFileSync("js/dreamjournal.js", "utf8");
const dm = fs.readFileSync("js/dream.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const eng = fs.readFileSync("js/engine.js", "utf8");
const nc = s => s.split("\n").map(l => l.split("//")[0]).join("\n");

test("① 一次只展开一条；收着的时候只露两行", () => {
  const c = nc(dj);
  assert.match(c, /const \[openId, setOpenId\] = useState\(null\);/);
  assert.match(c, /openId === e\.id \? null : \{ display: "-webkit-box", WebkitLineClamp: 2/);
  // 解法也收起来——一条梦加三个人的解法能有一屏那么长
  assert.match(c, /openId === e\.id \? \(e\.interpretations \|\| \[\]\)\.map/);
  // 收着时看得出底下还有东西
  assert.match(c, /"展开 · " \+ e\.interpretations\.length \+ " 个人解过"/);
});

test("② 做梦也吃反八股那一整套，人设不再截到 900 字", () => {
  const c = nc(dm);
  assert.match(c, /narrativeCore\(\{ intimate: true \}\)/);
  assert.match(c, /CONDESCENDING_TONE_BAN/);
  assert.match(c, /ContentBoundaries\.prompt/);
  assert.ok(c.indexOf("slice(0, 900)") < 0, "人设还截着 900 字");
  assert.match(c, /\.slice\(0, 6000\)/);
  // 此刻的状态也要给（梦顺着现在的他铺，不是顺着一份静态设定）
  assert.match(c, /session\.moodLine \? "\\n· 此刻心情："/);
  assert.match(c, /moodOf: cid =>/.test(app) ? /session\.affLine/ : /session\.affLine/);
  assert.match(app, /moodOf: cid => \{ const m = \(moods \|\| \{\}\)\[cid\] \|\| \{\}; return m\.label/);
});

test("③ 母题那个按钮：改名成看得懂的，而且先切回她的梦再展开", () => {
  const c = nc(dj);
  // 面板只画在 hers 那一栏里——站在「TA们的梦」点它当然没动静
  assert.match(c, /onClick: \(\) => \{ setView\("hers"\); setOpenMotif\(!openMotif\); \}/);
  assert.match(c, /\}, "反复梦见"\)/);
  assert.ok(c.indexOf('}, "母题")') < 0, "还叫「母题」，她说看不懂这词");
});

test("④ 梦签攒成一册", () => {
  const c = nc(dj);
  assert.match(c, /\["signs", "梦签"\]/);
  assert.match(c, /view === "signs" \?/);
  assert.match(c, /if \(it && it\.sign\) signs\.push/);
});

test("④ 看过他的梦＝轻轻进上下文：不发消息、不进记忆、三天过期", () => {
  const c = nc(dj);
  assert.match(c, /const markDreamSeen = d => \{/);
  assert.match(c, /saveJSON\("x_dreamSeen", all\)/);
  // 展开那场梦才算读过
  assert.match(c, /if \(!on\) markDreamSeen\(d\)/);
  // ctxFor 挑成一句轻的；三天自己过期
  assert.match(app, /dreamEcho: \(\(\) => \{/);
  assert.match(app, /3 \* 86400000/);
  assert.match(app, /别主动提起、别复述梦的内容、更别问她看没看/);
  // buildBundle 真的发出去了（声明了没人引用＝白写，v55.95 那个形状）
  assert.match(eng, /ctx\.dreamEcho && ctx\.dreamEcho\.trim\(\)\) parts\.push\(ctx\.dreamEcho\.trim\(\)\)/);
});
