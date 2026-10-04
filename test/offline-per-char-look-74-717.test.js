// 线下也给每个人单独一张皮（她 2026-10-03：「线下每个角色能不能单独做一个美化页面」）
//
// 走的是聊天那条「只给 TA 写 CSS」的同一条路：同一个编辑器（ChatCssFields）、
//   同一支限作用域（ThemeStudio.scopeCSS）、同一个「挂一块 style」的动作，
//   只是存在这个人的线下设置里、页面挂点换成线下那三个（offline/offbody/offcomposer）。
//
// ⚠️两处最容易写错、都栽过的：
//   ① 作用域只限页面不限人——线下那层所有人共用 data-wk="offline"，
//      一个人的皮会串到所有人的线下去（单聊、群聊各栽过一次）。
//   ② 判据写成 screen === "thread"——线下是盖在聊天页上的一层，screen 仍是 thread，
//      真正的判据是 offlineChar（现在开着谁的那一场）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");
const live = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const A = live(app), C = live(comp);
const PAINT = A.slice(A.indexOf("const offlineLookScope ="), A.indexOf("window.__previewOfflineLook"));

test("① 限到这个人，不是只限页面", () => {
  assert.match(A, /const offlineLookScope = id =>/, "没有线下那一支作用域");
  const line = A.split("\n").find(l => l.includes("const offlineLookScope"));
  assert.ok(/data-lisa-offchar/.test(line), "作用域里没有「是谁」这一截，皮会串到所有人的线下");
  assert.ok(/\[data-wk="offline"\]/.test(line), "没限到线下那一层");
  // 不许蹭 paintChatLook 管的那个属性：它只有【人在聊天页】时才写得上
  assert.ok(!/offlineLookScope = id => 'html\[data-lisa-char=/.test(A), "蹭了别人管的状态");
  assert.match(PAINT, /setAttribute\("data-lisa-offchar"/, "没有人去写这个属性，作用域永远命不中");
});

test("② 判据是 offlineChar，不是 screen", () => {
  assert.match(PAINT, /const on = !!offlineChar;/, "判据又写回 screen 了，线下开着也不生效");
  assert.match(A, /useEffect\(\(\) => \{ paintOfflineLook\(null\); \}, \[offlineChar && offlineChar\.id, offlineSettings, screen\]\)/,
    "重画的依赖不对：换人或改设置时不会重画");
});

test("③ 不安全的 CSS 不许挂上去", () => {
  assert.match(PAINT, /!window\.ThemeStudio\.unsafeReason\(os0\.customCSS\)/,
    "只在编辑框里提示一句就放过去了");
  assert.match(PAINT, /scopeCSS\(raw, scope\)/, "没限作用域就挂了");
  assert.match(PAINT, /resolveCSSImages\(/, "图片地址没换，自己图库里的图显示不出来");
});

test("④ 挂 style 那个动作收成一份，三处共用", () => {
  assert.match(C, /function mountStyle\(id, css\)/, "公共件不见了");
  assert.match(C, /function applyGroupLook\(css\) \{ mountStyle\("wk-group-look-css", css\); \}/, "群那层没搬过来");
  assert.match(C, /function applyOfflineLook\(css\) \{ mountStyle\("wk-offline-look-css", css\); \}/, "线下那层没走公共件");
  assert.match(C, /const put = mountStyle;/, "单聊那几层还留着自己那份手抄的");
});

test("⑤ 编辑器是聊天那一份，存在这个人的线下设置里", () => {
  const i = C.indexOf("const offSetPages = [");
  const j = C.indexOf("const scroller = useRef(null);", i);
  const SET = C.slice(i, j);
  assert.match(SET, /\{ key: "look", char: "样", title: "这个人的线下长什么样"/, "目录里没有这一类");
  assert.match(SET, /h\(ChatCssFields, \{ css: sCss, setCSS: setSCss/, "没用聊天那一份编辑器，又另写了一个");
  assert.match(SET, /page: "offline"/, "页面挂点不是线下那一套");
  assert.match(SET, /window\.__previewOfflineLook/, "「去看看」没接上预览");
  assert.match(SET, /bg: sBg, customCSS: sCss \}/, "保存那颗 ✓ 没把 CSS 一起存");
  assert.match(C, /const \[sCss, setSCss\] = useState\(os\.customCSS \|\| ""\);/, "没从这个人的线下设置里读回来");
});
