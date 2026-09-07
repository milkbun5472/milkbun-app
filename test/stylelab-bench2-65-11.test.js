// 文风台第二批（她 2026-09-06：「分批弄好」）：手写那张稿、样张、和整个测试台。
// 判据同第一批（施工规则/tabs-not-plain-pills.md）：搬到别的 app 里还成立，就是写坏了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SL = fs.readFileSync(path.resolve(__dirname, "..", "js/style-lab.js"), "utf8");

test("手写那一段是一张稿子：留着页边，竖一道红线", () => {
  const w = SL.slice(SL.indexOf("手写那一段是【一张稿子】"), SL.indexOf("这张稿排在"));
  assert.ok(w.length > 300, "抠不出手稿那一段");
  assert.match(w, /left: 22, top: 0, bottom: 0, width: 1, background: "rgba\(194,90,74,\.30\)"/, "页边那道红线没了");
  assert.match(w, /padding: "10px 11px 10px 30px"/, "正文没给页边让位，字会压在红线上");
  assert.match(w, /border: "none", outline: "none", background: "transparent"/, "还是那个通用输入框的边");
});

test("稿子排在字条前面还是后面：画的是位置本身，不是两颗药丸", () => {
  const w = SL.slice(SL.indexOf("// 稿子排在字条前面还是后面"), SL.indexOf("// 预览"));
  assert.ok(w.length > 600, "抠不出位置那一段");
  assert.match(w, /borderLeft: "2px solid " \+ t\.accent/, "那张纸没有红页边，跟字条分不开");
  assert.match(w, /\[0, 1, 2\]\.map/, "三根字条没了");
  assert.match(w, /val === "before" \? \[paper, slugs\] : \[slugs, paper\]/, "前后没换位置，那这张图就没在说位置");
  assert.match(w, /minHeight: 44/, "点不着");
  assert.match(w, /"aria-pressed": on \? "true" : "false"/, "读屏的人不知道选的是哪个");
});

test("组装出来那一块是样张：收起时下缘褪下去，不是被硬切一刀", () => {
  const w = SL.slice(SL.indexOf("// 样张：一张印出来的纸"), SL.indexOf("复制一份"));
  assert.ok(w.length > 300, "抠不出样张那一段");
  assert.match(w, /linear-gradient\(180deg, rgba\(255,255,255,0\) 0%, " \+ t\.bg2 \+ " 92%\)/, "褪那一层没了");
  assert.match(w, /!showFull && assembled/, "空的时候也盖一层，那就是白盖");
});

test("测试台：谁来写是一排名牌，认得出是哪个人", () => {
  const w = SL.slice(SL.indexOf("// 谁来写：一排名牌"), SL.indexOf("哪一场"));
  assert.match(w, /h\(Avatar, \{ character: c, size: 26, radius: 3 \}\)/, "名牌上没有那个人");
  assert.match(w, /transform: on \? "translateY\(1px\)" : "none"/, "选中那张没压下去");
  assert.match(w, /minHeight: 44/);
});

test("测试台：哪一场是一本薄剧本，翻开哪一折就摊开哪一折", () => {
  const w = SL.slice(SL.indexOf("// 场景是【剧本上的一折】"), SL.indexOf("跑哪几份"));
  assert.ok(w.length > 400, "抠不出剧本那一段");
  // 折号那一格：翻到的那一折上墨（形状＋位置＋色一起变）
  assert.match(w, /background: on \? t\.ink : "transparent", color: on \? t\.bg2 : t\.fog/, "折号没上墨");
  assert.match(w, /borderTop: i \? "1px solid " \+ t\.line : "none"/, "折与折之间不是一本册子");
  // 场面和第一句就在那一折底下摊开，不再单独摆一张卡
  assert.match(w, /on\s*\n?\s*\? h\("div", \{ style: Object\.assign\(\{\}, S\.hint/, "那一折没摊开");
  // ⚠️不许退回一排会换行的标签：换行之后「选中那张接着底下那页」当场就断了
  assert.ok(!/flexWrap: "wrap"[\s\S]{0,400}TEST_SCENES/.test(SL), "场景又排成会换行的一排标签了");
});

test("测试台：印哪几块版跟搭预设那一排是同一种东西，对照组是空版", () => {
  const w = SL.slice(SL.indexOf("// 印哪几块版"), SL.indexOf("最低字数"));
  assert.match(w, /plate\(\{ key: "__base", on: tPicks\.indexOf\(""\) >= 0/, "对照组没长成一块版");
  assert.match(w, /name: "对照组", sub: "空版 · 不吃预设", edge: t\.fog/, "没说清对照组是块空版");
  assert.match(w, /presets\.map\(p => plate\(/, "别的预设没用同一块版");
  // 最低字数走共用 Slider（一处写好、全 app 一个样，也白得 data-wk="slider"）
  assert.match(SL, /h\(Slider, \{ value: tMin, min: 0, max: 3000, step: 100/);
  assert.ok(!/type: "range"/.test(SL), "还自己写了一个裸 range");
});

test("测试台：试写那颗叫「印一张」，结果是一张张打样纸", () => {
  assert.match(SL, /busy \? "在写 " \+ busy \+ "…" : "印一张"/);
  const w = SL.slice(SL.indexOf("// 每一次试写＝一张打样纸"), SL.length);
  assert.ok(w.length > 600, "抠不出打样纸那一段");
  assert.match(w, /const bad = !!r\.err, thin = !bad && r\.want && r\.chars < r\.want;/);
  assert.match(w, /borderTop: "1px solid " \+ \(bad \? t\.accent : t\.line\)/, "印坏那张的纸脚没整条上红");
  assert.match(w, /bad \? "印坏了"/, "印坏了要一眼挑得出来，不用去读小字");
  assert.match(w, /color: bad \|\| thin \? t\.accent : t\.fog/, "字数没到也要标红");
  assert.ok(!/S\.card/.test(w), "还是那张通用圆角灰卡");
});
