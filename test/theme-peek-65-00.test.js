// v65.00 预览台：她 2026-09-06「设置里我们不都做了 css 主题工作台，既然做了那就得让他是真的，
// 而且设置页里也没有预览台，要跑出去看效果也很麻烦」。
//
// ⚠️这一版【不另画一份预览】。v62.02 删掉过一版 iframe 假预览，理由记在
// theme-studio-ui.js 里：那一版跟真页面共享的只有挂点名字，底色、层级、字体、组件
// 全是另写的——修过两轮还是对不上，**预览里对的东西上机不对，比没有预览更坏**
// （她照着它调）。所以这一颗做的是【把她送到那一页上】，改完再送回来。
//
// 三样必须成立，少一样这个功能就是摆设：
//   ① 跳过去的时候 CSS 真的在生效（不是跳过去看了个原样）；
//   ② 她回得来，而且【刚写的那段还在】；
//   ③ 去不成的时候要说话，不许静悄悄什么都不发生。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js"), studio = R("theme-studio.js"), ui = R("theme-studio-ui.js"), screens = R("screens.js");

test("预览可以给更长的时间；不传还是 30 秒", () => {
  const i = studio.indexOf("const preview = (p, ms) =>");
  assert.ok(i > 0, "preview 不收时长了");
  const seg = studio.slice(i, studio.indexOf("\n  };", i));
  assert.match(seg, /const span = Number\(ms\) > 0 \? Number\(ms\) : PREVIEW_MS;/, "不传时不再退回 30 秒");
  assert.match(seg, /timer = setTimeout\(cancelPreview, span\)/, "计时器没用上新的时长");
  assert.match(ui, /const PEEK_MS = 300000;/, "预览台那一路没给更长的时间");
  assert.match(ui, /studio\.preview\(draft, PEEK_MS\)/, "跳过去的时候没把时长传进去");
});

test("跳过去之前先让 CSS 生效，去不成就撤回来", () => {
  const i = ui.indexOf("const peek = () => {");
  assert.ok(i > 0, "peek 不见了");
  const seg = ui.slice(i, ui.indexOf("\n    };", i));
  // ① 先 preview 再 go：反过来的话她会先跳到一个【没变样】的页面上
  assert.ok(seg.indexOf("studio.preview(draft, PEEK_MS)") < seg.indexOf("why = go(page)"), "先跳了才让 CSS 生效");
  // ③ 去不成要说话，而且把刚armed的预览撤回来，别留一份没人管的
  assert.match(seg, /if \(why\) \{ studio\.cancelPreview\(\); toast\(why\); return; \}/, "去不成时没撤预览、或者没出声");
  assert.match(seg, /toast\("预览台还没准备好，请再点一次"\)/, "落点还没挂上时静悄悄什么都不做");
  assert.match(seg, /bar\(\{ page: page, zh: pageZh\(page\) \}\)/, "没让回程条浮出来");
  assert.match(seg, /lastSpot = \{ section: "css", page: page \}/, "没记下她刚才在哪一栏哪一页");
});

test("② 回得来，而且刚写的那段还在", () => {
  // 工作台是重新挂载的：照旧 load() 读的是【存档里那份】，她刚写的 CSS 当场没了
  assert.match(ui, /useState\(\(\) => \(studio\.isPreviewing\(\) && studio\.current\) \? studio\.current\(\) : studio\.load\(\)\)/,
    "回来时读的还是存档那份，草稿会丢");
  assert.match(studio, /const current = \(\) => active;/, "拿不到屏幕上真正生效的那一份");
  assert.match(studio, /load, save, apply, preview, commit, cancelPreview, current, iconRef,/, "current 没导出去");
  // 撤销键：预览还armed着回来时得能撤
  assert.match(ui, /\[previewing, setPreviewing\] = useState\(\(\) => studio\.isPreviewing\(\)\)/, "回来时撤销键不见了");
  // 落回原处
  assert.match(ui, /useState\(\(\) => \(lastSpot && lastSpot\.section\) \|\| "icons"\)/);
  assert.match(ui, /useState\(\(\) => \(lastSpot && lastSpot\.page\) \|\| "home"\)/);
  assert.match(ui, /useEffect\(\(\) => \{ lastSpot = null; \}, \[\]\);/, "读完没清掉，下次进工作台还会跳到上次那一页");
  // 设置页要落在主题工作台那一栏
  assert.match(screens, /useState\(\(\) => props\.initialPage \|\| "home"\)/, "设置页不认落点");
  assert.match(app, /setThemePeek\(null\); setConfigPage\("themeStudio"\); setScreen\("config"\);/, "回程条没把她送回工作台");
  assert.match(app, /initialPage: configPage,/, "落点没传给设置页");
});

test("落点这一层：去不成要照实说，不许静悄悄", () => {
  const i = app.indexOf("const go = key => {");
  assert.ok(i > 0, "__goScreen 不见了");
  const seg = app.slice(i, app.indexOf("\n    };", i));
  assert.match(seg, /if \(!k \|\| k === "all"\) return "「全 App」不是某一页/);
  assert.match(seg, /!SCREEN_ZH\[k\]\) return "没有这一页"/);
  // 有几页光 setScreen 站不住：替它挑一个默认的，一个都没有就说清楚
  assert.match(seg, /k === "thread" \|\| k === "contact" \|\| k === "castForm" \|\| k === "momprofile" \|\| k === "kincard"/);
  assert.match(seg, /if \(!c\) return "这一页得有个角色才看得见/);
  assert.match(seg, /if \(!g0\) return "这一页得有个群才看得见/);
  assert.match(seg, /setScreen\(k\);\s*\n\s*return "";/, "去成了要返回空串");
  assert.match(app, /window\.__goScreen = go;/);
  assert.match(app, /if \(window\.__goScreen === go\) delete window\.__goScreen;/, "卸载时没摘钩子");
});

test("回程条：说清在预览哪一页，走开了自己收起来", () => {
  const i = comp.indexOf("function ThemePeekBar({");
  assert.ok(i > 0, "回程条不见了");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(seg, /"正在预览 · " \+ zh/, "没说在预览哪一页");
  assert.match(seg, /"回去改"/);
  // 浮在底部：顶栏那一条正是她要看的东西，不许压住
  assert.match(seg, /bottom: 0, paddingBottom: "calc\(env\(safe-area-inset-bottom\) \* 0\.4 \+ 10px\)"/, "没照主聊天那把底部尺子");
  assert.match(seg, /minHeight: 44/, "点不着");
  // 深色主题里不许写死白（tabs-not-plain-pills §2）
  assert.match(seg, /color: t\.ink, background: t\.bg2/, "回去改那颗的字色没跟着主题走");
  assert.ok(!/"#fff"/.test(seg), "又写死回白了");
  // 她自己走开了，条就该收
  assert.match(app, /if \(themePeek && screen !== themePeek\.page\) setThemePeek\(null\)/, "走开了那条还在别的页上说「正在预览 · 日记」");
});

test("入口：页面 CSS 那一栏里，「全 App」时那颗是灰的并说清为什么", () => {
  assert.match(ui, /h\("button", \{ onClick: peek, disabled: page === "all"/, "「全 App」时那颗没有灰掉");
  assert.match(ui, /\}, "去这一页看看"\)\)/, "按钮不见了");
  assert.match(ui, /page === "all" \? "「全 App」不是某一页——挑一页再点右边那颗。"/, "灰掉了却没说为什么");
  assert.match(ui, /"点右边那颗直接跳到这一页看真的样子，底下会浮一条「回去改」送你回来。"/);
  // 设置首页那张卡上的说明要跟着改：v62.02 起「应用前预览」已经删掉了
  assert.match(screens, /sub: "图标、页面 CSS、主题包；改完能直接跳到那一页看"/, "卡上还写着已经删掉的那个功能");
  assert.ok(!/主题包与应用前预览/.test(screens), "旧那句还在");
});
