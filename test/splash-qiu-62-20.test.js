// 开屏「秋」（v62.20，她 2026-09-04 拍板）：内联在 index.html、React 挂载前开播。
// 这几条守的是【开屏永远不能挡住 App】和几样答应过她的纪律。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const i = idx.indexOf('<div id="qiu-splash">');
assert.ok(i > 0, "开屏块不在 index.html 里");
const sp = idx.slice(i, idx.indexOf("</script>", i));

test("开屏坏了绝不能挡住 App：整段 try/catch，出错自拆", () => {
  assert.match(sp, /try \{/);
  assert.match(sp, /catch \(e\) \{ try \{ host\.remove\(\); \} catch \(e2\) \{\} \}/, "出错没有自拆");
  // 它在 root 之后、所有 app 脚本之前——React 挂载前就开播，盖住的是本来白等的启动
  assert.ok(i > idx.indexOf('<div id="root">'), "要放在 root 之后");
  assert.ok(i < idx.indexOf('js/core.js?v='), "要在 app 脚本之前开播");
});

test("答应她的几条纪律都在：停住等「翻开」、点空白快进、减动效、暗主题", () => {
  assert.match(sp, /prefers-reduced-motion: reduce/, "减动效的人也被强看动画");
  // v62.21 她 2026-09-04：「还没看完它就跳走了」——扉页播完【停住】，按「翻开」才进。
  // 所以这里绝不许再有 setTimeout(out, ...) 那种自动跳走。
  assert.ok(!/setTimeout\(out,/.test(sp), "又开始自动跳走了——她点名要停住等按钮");
  assert.match(sp, /btn\.textContent = "翻 开"/, "门没了（跟日记封面同一个动词）");
  assert.match(sp, /btn\.addEventListener\("click", out\)/, "按了门也不进");
  assert.match(sp, /min-height:44px/, "按钮不够点（40px 手感那条）");
  // 等不及的点空白＝快进到完成态，不是跳走
  assert.match(sp, /if \(ev\.target !== btn\) finish\(\)/, "点空白直接跳走了，该是快进");
  assert.match(sp, /localStorage\.getItem\("x_theme"\)/, "不看主题，深色主题开屏闪一大块奶油白");
  assert.match(sp, /dark = \(0\.299 \* r \+ 0\.587 \* g2 \+ 0\.114 \* b2\) < 128/, "亮暗判断没了");
});

test("颜色按季节走，那行日子跟名片同一个数（v62.23）", () => {
  // 颜色仍从立秋起算（入了冬停在最深那档——秋是他的名字，四季常驻）
  assert.match(sp, /new Date\(YEAR, 7, 7\)/, "颜色不是从立秋起算");
  assert.match(sp, /var LEAF = rgb\(\[184, 165, 69\], \[181, 80, 46\]\)/, "叶的色带没了");
  assert.match(sp, /INK_WET/, "湿墨那一层没了（落笔略深、吸进纸里再柔下来）");
  assert.match(sp, /"strokes":/, "笔画数据没内嵌——开屏不许发网络请求");
  // 天数只许【读】名片落的起点，不许自己再算一份——开屏读不到 IDB，自己算必错
  assert.match(sp, /localStorage\.getItem\("x_firstDayTs"\)/, "没读名片落的起点");
  assert.ok(sp.indexOf("x_memLib") < 0, "开屏自己去翻档案了——那份在 IDB 里，这儿只会读到 null");
  assert.match(sp, /来这儿 · 第/, "那行日子没了");
  assert.ok(sp.indexOf("入秋 · 第") < 0, "还写着入秋第 N 天——冬天咋办");
  // 写入方在名片那一处（stub-from-the-writer：钉住写的人，改了字段这条当场红）
  const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
  assert.match(comp, /localStorage\.setItem\("x_firstDayTs", String\(first\)\)/, "名片不落起点了，开屏永远第 1 天");
});
