// 她 2026-09-06（截图）：「秋秋这个能改 css 是假的，应用了也不改」。
//
// ⚠️病根不在写入那一头——applyOne/snippetEdit/ThemeStudio.commit 都是好的，
//   CSS 真的存进去了。问题是【存进去的那段 CSS 一条也匹配不到东西】：
//   模型自己发明了 `.theme-stylelab [data-page="stylelab"]` 这种选择器。
//   它会这么写，是因为秋秋的提示词里关于 theme 只有一句「text 是 CSS」——
//   没告诉它这三件事：
//     ① 这个 App 的样式几乎全是【内联 style】，不带 !important 等于没写；
//     ② 页面 CSS 会被系统【自动加作用域】，自己再加前缀就永远匹配不到；
//     ③ 只有聊天页埋了 data-wk 钩子，别的页一个都没有。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.resolve(__dirname, "..", f);
const R = f => fs.readFileSync(P(f), "utf8");
const studio = R("js/theme-studio.js"), assistant = R("js/assistant.js");

test("钩子清单只有一份，秋秋引用它、不另抄一份", () => {
  assert.match(studio, /const WK_HOOKS = Object\.freeze\(\[/);
  assert.match(studio, /CSS_BUILTINS, WK_HOOKS, WK_PAGES,/, "没导出去，秋秋拿不到");
  assert.match(assistant, /ts\.WK_HOOKS\.map/, "秋秋没引用那一份");
  // ⚠️assistant 里不许再铺一份钩子名单
  const shown = assistant.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.ok(!/data-wk="chathead"[\s\S]{0,200}data-wk="bubble"/.test(shown), "秋秋里又抄了一份钩子表");
});

// ⚠️桩钉在【写它那一头】（stub-from-the-writer.md）：清单里每一个钩子，
//   都必须真的作为 data-wk 属性出现在源码里。谁哪天改了属性名或删了一个点，
//   这条当场红——不然秋秋会照着一张过期的地图写 CSS，而且照样不报错。
test("清单上的每个钩子，源码里都真的挂着", () => {
  const src = ["js/components.js", "js/screens.js", "js/phone.js", "js/dwell.js", "js/fanfic.js"]
    .map(f => { try { return R(f); } catch (e) { return ""; } }).join("\n");
  // ⚠️只在 WK_HOOKS 那一块里抠，别把 WK_PAGES 的 ["thread","gthread"] 也捞进来
  const blk = studio.slice(studio.indexOf("const WK_HOOKS"), studio.indexOf("const WK_PAGES"));
  const names = [...blk.matchAll(/\["([a-z]+)", "/g)].map(m => m[1]);
  assert.ok(names.length >= 15, "抠出来的钩子太少：" + names.length);
  // ⚠️两种挂法都算数：直接写 "data-wk"，或者作为 wk 属性传给图标组件（它自己转成 data-wk）
  const missing = names.filter(n => src.indexOf('"data-wk": "' + n + '"') < 0
    && src.indexOf('wk: "' + n + '"') < 0 && src.indexOf('wk="' + n + '"') < 0);
  assert.deepEqual(missing, [], "清单上有、源码里没挂：" + missing.join("、"));
});

test("有钩子的页面就是聊天那两页——别的页写 CSS 抓不住东西", () => {
  assert.match(studio, /const WK_PAGES = Object\.freeze\(\["thread", "gthread"\]\)/);
  // 内置皮肤也只给这两页，两处说的得是同一件事
  assert.match(studio, /const CSS_BUILTINS = \{ thread: CHAT_SKINS, gthread: CHAT_SKINS \}/);
});

test("秋秋被告知了那三件事，而且被要求【说实话】而不是硬出一份改不动的 CSS", () => {
  const note = assistant.slice(assistant.indexOf("function themeCssNote"), assistant.indexOf("const SHAPE"));
  assert.ok(note.length > 300, "抠不出那一段");
  assert.match(note, /每一条声明都要带 !important/, "没说内联样式压不过");
  assert.match(note, /绝不要自己加 \.theme-xxx 或 \[data-page=\.\.\.\] 这类前缀/, "没说系统会自动加作用域");
  assert.match(note, /别的页面一个钩子都没有/, "没说只有聊天页有钩子");
  assert.match(note, /先说实话/, "没要求它承认改不动");
  assert.match(note, /不许硬出一份改不动的 CSS 糊弄过去/);
  // 真的拼进了那段提示词，不是算了没人用（v55.95 那个形状）
  assert.match(assistant, /\+ \(pages \? "，或某一页：" \+ pages : ""\) \+ "）\\n" \+ themeCssNote\(\)/, "算了没拼进去");
});

test("拿不到主题工作台时安静降级，别把整段提示词搞崩", () => {
  const note = assistant.slice(assistant.indexOf("function themeCssNote"), assistant.indexOf("const SHAPE"));
  assert.match(note, /if \(!ts \|\| !ts\.WK_HOOKS\) return "";/);
});
