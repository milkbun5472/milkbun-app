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

// v61.49 她 2026-09-04：「那宝宝再把界面装修一下吧」
test("整页是夜色纸，梦是压在夜色上的一张张浅纸条", () => {
  const c = nc(dj);
  assert.match(c, /const nightBg = \{/);
  assert.match(c, /const paperCard = \(extra\) =>/);
  // 底纹铺在最外面那个外壳上、顶栏透明（mobile-ui-layout.md §3.5）
  assert.match(c, /h\("div", \{ className: "h-full flex flex-col", style: nightBg \}/);
  assert.match(c, /bg: "transparent", ink: NINK/);
  // 星尘位置写死：随机的话每次重画都在动
  assert.ok(c.indexOf("Math.random()") < 0 || c.indexOf("Math.random().toString(36)") >= 0);
});

test("分栏是书口上垂下来的布书签，不是一排药丸", () => {
  const c = nc(dj);
  assert.match(c, /const ribbon = \(k, label\) =>/);
  // 燕尾剪口＋选中那条更长——形状和高度都在变，不是只换个填色
  assert.match(c, /clipPath: "polygon\(0 0,100% 0,100% 100%,50% calc\(100% - 7px\),0 100%\)"/);
  // v64.25：长度差还在，只是搬了个地方——原来是【那颗键】自己缩到 36，
  // 于是没选中的两条整个只有 36 高，够不着「可点区域别低于 40」那条线。
  // 现在键一直 46，缩的是里头那条带子（没选中的少垂 10px），
  // 看着一模一样，底下那 10px 仍然点得着。
  assert.match(c, /height: 46, background: "transparent"/, "键又跟着选中态缩了");
  assert.match(c, /top: 0, bottom: on \? 0 : 10/, "带子不缩了，三条一样长");
  assert.ok(c.indexOf("borderRadius: 999, border: \"1px solid \" + (view === k") < 0, "又变回药丸了");
});

test("Head 多了一个 ink 口子：页面自带底色时顶栏的字跟着走", () => {
  const comp = fs.readFileSync("js/components.js", "utf8");
  const i = comp.indexOf("function Head({");
  const head = comp.slice(i, comp.indexOf("\n}\n", i));   // ⚠️切到函数结尾，不用定长窗口（多几个口子就把要找的行挤出去了）
  assert.match(head, /const INK = ink \|\| t\.ink;/);
  // ⚠️v64.90 起分隔线还看 ink 本身是深是浅：深墨（牛皮纸、绿纸论坛）配黑影，浅墨才配白影
  assert.match(head, /const LINE = lineInk \|\| \(ink \? \(LIGHT_INK \? "rgba\(255,255,255,\.14\)" : "rgba\(0,0,0,\.12\)"\) : t\.line\)/);
  // ⚠️v64.86 起返回箭头多带一个 wk: "headink"（让页面 CSS 抓得住它的描边），
  //   所以这里不再钉死大括号里只有那两项——要钉的是「颜色跟着 INK 走」，不是那一行的长相。
  assert.match(head, /React\.createElement\(IArrow, \{ size: 18, color: INK[^}]*\}\)/);
});

test("标签里不留 emoji（跟情侣空间那次同一条）", () => {
  const c = nc(dj);
  assert.deepEqual(c.match(/[\u{1F000}-\u{1FAFF}]/gu) || [], []);
  assert.match(c, /const KIND = \{ dream: \["完整的梦"/);
});
