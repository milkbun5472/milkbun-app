// 两颗黑悬浮（她 2026-09-05：「宝宝你把这俩黑悬浮弄好看点吧」）。
//
// 病不在「有黑」，在【整块都是黑的】：一条近黑的板子和一颗近黑的圆球，压在她那张
// 暖色壁纸上像贴了两张膏药，而且换个 app 照样成立（tabs-not-plain-pills.md 那条判据）。
// 改法是先问【这东西在现实里是什么】：
//   · 悬浮播放条＝一张还在转的唱片压在纸上 → 底板换成这个 app 的纸，黑只留在碟上；
//   · 那颗圆球＝一个选线路的旋钮 → 就照旋钮做（金属边、指针、三颗刻度）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), app = R("app.js");
const mini = comp.slice(comp.indexOf("function MiniPlayer({"), comp.indexOf("// 全屏月历"));
const knob = app.slice(app.indexOf('"aria-label": "快速切换模型"'), app.indexOf("// 一起听·本地音频存 IndexedDB"));

test("播放条：底板是这个 app 的纸，不再是一块近黑的板子", () => {
  assert.ok(mini.length > 800, "抠不出 MiniPlayer");
  // ⚠️只看真代码：注释里为了说清病因写着那个旧色号，别把注释也判成没改
  const code = mini.split("\n").filter(l => l.trim().indexOf("//") !== 0).join("\n");
  assert.doesNotMatch(code, /background: "rgba\(28,26,24/, "还是那块黑板");
  assert.match(mini, /background: skinAlpha\(t\.bg2, "F2"\)/, "底没跟着主题走");
  // ⚠️深色主题里 t.bg2 是深的，所以字【绝不许写死 #fff】——浅色主题上就是白底白字
  //   （mobile-ui-layout.md 那条，v59.62 抓到过一次）
  assert.doesNotMatch(mini, /fill: "#fff"|color: "#fff"|rgba\(255,255,255,0?\.6\)/, "还有写死的白");
  assert.match(mini, /const ink = t\.ink \|\| "#3a3430";/);
  // 拼透明度要过 skinAlpha：主题色不是六位色号时它原样返回，不会拼出废值
  assert.match(mini, /skinAlpha\(ink, "1e"\)/);
});

test("播放条上那张碟还是碟——黑留在该黑的那一样东西上", () => {
  assert.match(mini, /repeating-radial-gradient\(circle at 50% 50%, #24242a 0 1\.5px, #17171c 1\.5px 3px\)/, "碟纹没了，就成了一个圆头像");
  assert.match(mini, /animation: playing \? "wk-spin 9s linear infinite" : "none"/, "不转了");
  assert.match(mini, /background: cover \? "center\/cover no-repeat url\(" \+ cover \+ "\)"/, "封面没当成碟标");
  // 38px 上不画唱臂：大碟那份（VinylDisc）才有臂，这儿画上去只会糊成一团
  assert.doesNotMatch(mini, /transformOrigin: "84px 12px"/);
});

test("位置、拖动、层级一个都没动（那几样是修过很多次的）", () => {
  assert.match(mini, /\{ right: 12, bottom: 84 \}/, "默认位置被挪了");
  assert.match(mini, /zIndex: MINI_PLAYER_Z/, "层级被改写死了");
  assert.match(mini, /localStorage\.setItem\("x_miniPos"/, "拖完记不住位置了");
  assert.match(app, /top: pos \? pos\.top : "42%"/, "旋钮的默认位置被挪了");
  assert.match(app, /localStorage\.setItem\("x_modelFloatPos"/, "旋钮拖完记不住位置了");
});

test("那颗球改成【旋钮】：画出来的，不是一个等宽字体的箭头", () => {
  assert.ok(knob.length > 400, "抠不出那颗按钮");
  assert.doesNotMatch(knob, /rgba\(25,24,22,\.88\)/, "还是那颗黑球");
  assert.doesNotMatch(knob, /fontFamily: "monospace"/, "还在用等宽字体的字符当图标");
  assert.doesNotMatch(knob, /"⇄"/, "⇄ 还在");
  // 金属面 + 指针 + 三颗刻度：形状本身说明它是个选择器
  assert.match(knob, /conic-gradient\(from 210deg/, "面上没有金属那圈光");
  assert.match(knob, /\[\[23, 5\.4\], \[38\.6, 27\.4\], \[7\.4, 27\.4\]\]/, "三颗刻度没了");
  assert.match(knob, /transform: "rotate\(" \+ \(open \? 135 : 0\) \+ "deg\)"/, "拉开时指针不转");
  // 拉开的时候中间是 ×，一眼知道再点一下收起来（不只靠指针转过去）
  assert.match(knob, /open\n?\s*\? h\("path", \{ d: "M20 20l6 6M26 20l-6 6"/);
  assert.match(knob, /"aria-label": "快速切换模型"/, "读屏的名字丢了");
});
