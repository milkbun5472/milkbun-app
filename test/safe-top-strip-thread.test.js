const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// v56.58 是把这套结构拆了，主屏当场坏（见 .claude/rules/home-screen-layout.md）。
// 这几条是那次的封条：结构和高度一个都不许再动，只准动颜色。
test("100vh 那一套原封不动——这是底部白边的最终解法", () => {
  assert.match(html, /html, body, #root \{ height: 100vh;/, "壳子的 100vh 没了");
  assert.match(html, /html, body \{ width: 100%; height: 100vh; overflow: hidden;/);
  assert.match(app, /height: "100vh"/, "app 外壳的 100vh 没了");
  assert.match(comp, /height: "100vh", \/\/ 保持 100vh（底部白边最终解法，勿改成 100%\/dvh）/, "Home 的 100vh 没了");
  // 只看真赋值：注释里那句「不用 100dvh／dvh 只撑到 WebKit 可视区」是说明，不是用法
  [html, app, comp].forEach(s => assert.doesNotMatch(s, /[:=]\s*["']?\d+dvh/, "不许真的用上 dvh"));
});

// ai-virtual-phone 的聊天页压根没有这条空带：消息区 absolute inset-0 铺满整屏，
// 顶栏浮在上面、自己把刘海吃掉。两个元素两层毛玻璃才会在交界处留缝——那就是白边。
test("单聊时空带归零，别处照旧留着", () => {
  assert.match(app, /const _safeTop = \{ height: screen === "thread" \? 0 : "env\(safe-area-inset-top\)" \};/,
    "空带的高度写法被改了");
  assert.match(app, /isStandalone \? \/\*#__PURE__\*\/React\.createElement\("div", \{\s*style: _safeTop,/,
    "空带不在原来的位置上了");
});

test("空带归零那一份高度，由单聊顶栏自己接住", () => {
  const i = comp.indexOf('className: "shrink-0 px-4 pb-3 flex items-center gap-3"');
  assert.ok(i > 0, "单聊顶栏的 class 变了");
  const seg = comp.slice(i, i + 420);
  assert.match(seg, /paddingTop: "calc\(env\(safe-area-inset-top, 0px\) \+ 20px\)"/, "顶栏没把刘海吃下去");
  assert.match(seg, /background: dsp\.chatBg \? "rgba\(255,255,255,0\.55\)" : t\.bg2/, "顶栏底色不该变");
  assert.doesNotMatch(seg, /pt-5/, "别再留 tailwind 的 pt-5，会和 paddingTop 打架");
});

// 白带的真正病因：那条空带一直跟着根节点涂 theme.bg，而单聊顶栏是 t.bg2 或聊天壁纸
// 试水就只试单聊：别的界面这一版必须一个像素都不变
test("只在单聊里试，别处一个字不动", () => {
  const i = app.indexOf("const _safeTop =");
  const seg = app.slice(i, app.indexOf("return /*#__PURE__*/React.createElement(ThemeContext.Provider", i));
  const screens = [...seg.matchAll(/screen === "(\w+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(screens)], ["thread"], "这一版不该碰单聊以外的界面");
});

test("主屏那条路一个字没动", () => {
  assert.match(app, /\(screen === "home" && wallpaper\) \? _imgUrl\(wallpaper\)/, "主屏仍旧把壁纸铺到根节点");
});

// 有聊天壁纸时走主屏那套：壁纸上根节点、单聊自己透明，免得拼出一条缝
test("有聊天壁纸就把它铺到根节点，单聊自身透明", () => {
  assert.match(app, /_threadBg \? _imgUrl\(_threadBg\)/, "壁纸没铺到根节点");
  const i = comp.indexOf("style: dsp.chatBg ? {");
  const seg = comp.slice(i, i + 340);
  assert.match(seg, /background: "transparent"/, "单聊自己还在画一遍壁纸，会和上面那条拼出缝");
  assert.doesNotMatch(seg, /backgroundImage/, "旧的那份要删掉，不是留着");
});
