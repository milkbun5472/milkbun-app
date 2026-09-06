// 她 2026-09-06：「全部能做主题的页面秋秋都应该可以改」。
//
// ⚠️挂点（data-wk）到不了那儿：全 App 九十来页正文里的卡片、按钮、列表
//   都是各页自己内联写的，没有共用组件——一页一页去挂是挂不完的。
//   但它们的颜色【全是从同一份 token 里取的】，而 token 只在 ThemeContext.Provider
//   那一处发出去。所以这一版换了条路：不改 CSS，改那一页拿到的 token。
//   一处改，那一页所有东西跟着变，一个挂点都不需要，于是每一页都成立。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const studio = R("js/theme-studio.js"), app = R("js/app.js"), asst = R("js/assistant.js"),
      comp = R("js/components.js"), ui = R("js/theme-studio-ui.js");

// ⚠️theme-studio.js 在 node 里 require 不动（收尾要 document），所以把那一块真的抠出来跑：
//   桩钉在【写它那一头】——谁改了这几个函数，下面每一条都跟着变。
const load = () => {
  const blk = studio.slice(studio.indexOf("const TOKENS = Object.freeze(["), studio.indexOf("const SLOT_KEY"));
  assert.ok(blk.length > 400, "抠不出那一块");
  let cur = {};
  const api = new Function("current", blk + "\nreturn { TOKENS, TOKEN_KEYS, okColor, cleanTokens, tokensFor, themeFor };")(() => cur);
  api.__set = v => { cur = v; };
  return api;
};

test("八支色是一张表，秋秋和界面都问它要", () => {
  const T = load();
  assert.equal(T.TOKENS.length, 8);
  assert.deepEqual(T.TOKEN_KEYS.slice().sort(), ["accent", "bg", "bg2", "fog", "ink", "line", "sub", "tint"]);
  // 这八支必须真的是 useTheme() 那份 token 的栏（不然改了也没人取）
  const def = R("js/core.js").slice(R("js/core.js").indexOf("const DEFAULT_THEME = {"));
  T.TOKEN_KEYS.forEach(k => assert.ok(new RegExp("\\n  " + k + ": \"").test(def), "DEFAULT_THEME 里没有 " + k));
  assert.match(studio, /CSS_BUILTINS, WK_COMMON, WK_SCOPED, TOKENS, TOKEN_KEYS, okColor, cleanTokens, tokensFor, themeFor,/,
    "没导出去，秋秋和界面都拿不到");
});

test("颜色只收干净的写法：它最后是被当成行内样式的值用的", () => {
  const T = load();
  ["#fff", "#f2ece0", "#f2ece0cc", "rgb(20,30,40)", "rgba(20,30,40,.5)", "hsl(30 40% 50%)", "tomato"]
    .forEach(v => assert.ok(T.okColor(v), "该收的没收：" + v));
  ["", "  ", "red; background:url(x)", "expression(1)", "javascript:1", "url(x)", "#12345", "var(--x)", "红色的那种"]
    .forEach(v => assert.ok(!T.okColor(v), "该挡的没挡：" + v));
});

test("只收这八支，别的一律丢掉——脏值不许落进存档", () => {
  const T = load();
  assert.deepEqual(T.cleanTokens({ bg2: "#123456", nope: "#123456", ink: "red; background:url(x)", sub: "  " }),
    { bg2: "#123456" });
  assert.deepEqual(T.cleanTokens(null), {});
});

test("没换过色的页面，拿到的还是【原来那一个对象】", () => {
  const T = load();
  const base = { bg: "#eee", bg2: "#fff", ink: "#111" };
  T.__set({ pageTokens: {} });
  assert.equal(T.themeFor("diary", base), base, "换了对象身份＝整棵树白重渲染一遍");
  T.__set({ pageTokens: { cast: { bg2: "#263a29" } } });
  assert.equal(T.themeFor("diary", base), base, "别的页也被带上了");
  const got = T.themeFor("cast", base);
  assert.deepEqual(got, { bg: "#eee", bg2: "#263a29", ink: "#111" });
  assert.equal(T.themeFor("cast", base), got, "同样的一份该记住，不要每次渲染都新造一个");
});

test("读的是【此刻正生效的那份】，不是存档——不然预览时颜色纹丝不动", () => {
  assert.match(studio, /const tokensFor = page => cleanTokens\(\(\(current\(\) \|\| \{\}\)\.pageTokens \|\| \{\}\)\[page\]\);/);
  // 存档结构里也要有这一栏，否则存进去下次就没了
  assert.match(studio, /pageCSS: \{\}, pageTokens: \{\}, updatedAt: 0/);
  assert.match(studio, /Object\.keys\(x\.pageTokens \|\| \{\}\)\.forEach/, "normalize 没洗这一栏");
});

test("发下去的就是这一页那一份，而且改完当场重画", () => {
  assert.match(app, /window\.ThemeStudio\.themeFor\(screen, theme\)\s*: theme;/, "Provider 没问它要");
  assert.match(app, /value: _pageTheme/, "还在发全局那一份");
  // 主题改了要有人重画：ThemeStudio 只广播一个事件，没人听等于改了看不见
  const tick = app.slice(app.indexOf("const [, bumpThemeTick]"), app.indexOf("const [wallpaper, setWallpaper]"));
  assert.match(tick, /window\.addEventListener\("lisa-theme-change", fn\)/);
  assert.match(tick, /removeEventListener\("lisa-theme-change", fn\)/, "没退订");
});

test("秋秋能改任意一页的配色，页名写错当场红", () => {
  assert.match(asst, /pagecolor: \{/, "没有这一栏");
  assert.match(asst, /const knownPage = \(ts, id\) => \(ts\.PAGES \|\| \[\]\)\.some\(x => x\[0\] === id\);/,
    "页名没有校验（写错会静静存进一个谁也读不到的键，界面上还报「改好了」）");
  const pc = asst.slice(asst.indexOf("pagecolor: {"), asst.indexOf("memory: {"));
  assert.match(pc, /if \(!knownPage\(ts, id\)\) throw new Error\(badPage\(ts, id\)\);/);
  assert.match(pc, /ts\.cleanTokens\(cur\)/, "自己另写了一份白名单");
  assert.ok(!/TOKEN_KEYS\s*=|okColor\s*=/.test(pc), "把颜色白名单又抄了一份进来");
  assert.match(pc, /if \(v === "" \|\| v == null\) delete cur\[k\]/, "没有「改回原样」的口子");
  // CSS 那一栏也要校验页名（原来任何字符串都收）
  const th = asst.slice(asst.indexOf("    theme: {"), asst.indexOf("pagecolor: {"));
  assert.match(th, /if \(id !== "global" && !knownPage\(ts, id\)\) throw new Error\(badPage\(ts, id\)\);/);
  // 它是一份 JSON：不许走「改一小段」
  assert.match(asst, /if \(p\.target === "pagecolor"\) throw new Error\("配色这一栏要整份给，不能改一小段"\);/);
  // 模型得知道有这一栏：形状里和清单里都要有
  assert.match(asst, /"target":"style\|persona\|appearance\|profile\|theme\|pagecolor\|bubble\|memory"/);
  assert.match(asst, /· pagecolor 某一页的配色/);
});

test("秋秋被明确告知：抓不住的那些改颜色走 pagecolor，别硬写 CSS", () => {
  const note = asst.slice(asst.indexOf("function themeCssNote"), asst.indexOf("const SHAPE"));
  assert.match(note, /没有单独的钩子/);
  assert.match(note, /要走 pagecolor 那一栏/);
  assert.match(note, /每一页都能改，不需要钩子/);
  assert.match(note, /先说实话/);
});

test("九十来页共用的那几个控件也挂上了挂点", () => {
  // ⚠️挂在【组件自己】身上，一处挂上九十来页一起有（不是一页一页补）
  const one = (fn, next, hook) => {
    const blk = comp.slice(comp.indexOf(fn), comp.indexOf(next));
    assert.ok(blk.length > 60 && blk.length < 4000, "抠不出 " + fn);
    hook.forEach(hk => assert.match(blk, new RegExp('"data-wk": "' + hk + '"'), fn + " 没挂 " + hk));
  };
  one("function Toggle({", "function Slider({", ["toggle", "toggleknob"]);
  one("function Slider({", "function LineField({", ["slider"]);
  one("function LineField({", "function LineInput(", ["field", "fieldlabel", "fieldline"]);
  one("function LineInput(", "function LineArea(", ["input"]);
  one("function LineArea(", "// 液态玻璃", ["textarea"]);
  assert.match(comp, /"data-wk": "toggle",\n\s*"data-on": on \? "1" : "0"/, "开关认不出开着还是关着");
  // 登记进「每一页都有」那一份，秋秋才知道
  const wk = studio.slice(studio.indexOf("const WK_COMMON"), studio.indexOf("const WK_SCOPED"));
  ["field", "fieldlabel", "fieldline", "toggle", "toggleknob", "input", "textarea", "slider"]
    .forEach(k => assert.ok(wk.indexOf('["' + k + '", "') >= 0, "WK_COMMON 里少了 " + k));
});

test("她自己也能在主题台里换：走的是同一份草稿，不是另开一条写入口", () => {
  const css = ui.slice(ui.indexOf('section === "css"'), ui.indexOf("这一页抓得住的挂点"));
  assert.match(css, /这一页单独换几支色/);
  assert.match(css, /\(studio\.TOKENS \|\| \[\]\)\.map/, "名单在这儿又抄了一份");
  // ⚠️两处都要走草稿：改一支色、和「全部还原」。少一处那一处就绕开了预览和正式应用。
  assert.equal((css.match(/patchDraft\(\{ pageTokens: all \}\)/g) || []).length, 2,
    "有一处没走草稿——那样「先预览 30 秒」和「正式应用」都管不到它");
  assert.ok(!/studio\.(commit|save|setPageTokens)\(/.test(css), "自己另开了一条提交路");
  assert.match(css, /全部还原/, "换坏了退不回去");
});
