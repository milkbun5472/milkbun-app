// 她 2026-09-13 带截图报：「别人的日历有时候会往上移，下面变白，箭头跑到上面不可交互的地方」。
//
// 整页往上移了：顶栏被推到刘海底下，那儿点不着；下面空出一条白。
// 而 html/body 是 100vh + overflow:hidden——手指滚不动这一层，所以**滚上去就回不来**。
// 谁滚的：iOS 为了把拿到焦点的那颗按钮／输入框滚进视野，会去滚这一层（键盘收起也不还）。
//
// 两道一起做：
//   ① 兜底那道是全 App 的——这一层一动就按回去（任何一页有输入框都可能中，不是日历一页的事）。
//   ② 日历那一页把自己那格漏掉的 min-h-0 和外壳的 overflow-hidden 补上：
//      别让它先把页面顶高（施工规则/mobile-ui-layout.md §3）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 真跑那段兜底：把它抠出来，拿一个假的 window/document 喂进去
const mkGuard = () => {
  const i = html.indexOf("  (function () {\n    var root = document.getElementById(\"root\");");
  const j = html.indexOf("</script>", i);
  assert.ok(i > 0 && j > i, "抠不出那段兜底");
  const src = html.slice(i, j);
  const handlers = {};
  const state = { page: { x: 0, y: 0 }, se: { scrollTop: 0, scrollLeft: 0 }, body: { scrollTop: 0, scrollLeft: 0 }, rootEl: { scrollTop: 0, scrollLeft: 0 }, active: null };
  const win = {
    get pageYOffset() { return state.page.y; }, get pageXOffset() { return state.page.x; },
    scrollTo: (x, y) => { state.page.x = x; state.page.y = y; },
    addEventListener: (k, fn) => { (handlers[k] = handlers[k] || []).push(fn); },
    visualViewport: { addEventListener: (k, fn) => { (handlers["vv:" + k] = handlers["vv:" + k] || []).push(fn); } }
  };
  const doc = { scrollingElement: state.se, documentElement: state.se, body: state.body,
    getElementById: id => (id === "root" ? state.rootEl : null), get activeElement() { return state.active; } };
  new Function("window", "document", "setTimeout", src)(win, doc, fn => fn());   // 抠出来的本来就是一整个 IIFE
  return { fire: (k, ...a) => (handlers[k] || []).forEach(fn => fn(...a)), state };
};

test("这一层被滚上去了：立刻按回去（四处都按，别漏）", () => {
  const g = mkGuard();
  g.state.page.y = 47; g.state.se.scrollTop = 47; g.state.body.scrollTop = 12; g.state.rootEl.scrollTop = 9;
  g.fire("scroll");
  assert.equal(g.state.page.y, 0, "window 没按回去");
  assert.equal(g.state.se.scrollTop, 0, "scrollingElement 没按回去");
  assert.equal(g.state.body.scrollTop, 0, "body 没按回去");
  assert.equal(g.state.rootEl.scrollTop, 0, "#root 没按回去");
});

test("她正在打字的时候不许按：那一下是 iOS 在把输入框顶到键盘上方", () => {
  const g = mkGuard();
  g.state.active = { tagName: "TEXTAREA" };
  g.state.page.y = 120;
  g.fire("scroll");
  assert.equal(g.state.page.y, 120, "把她正在打字的那一行推到键盘底下了");
  // 换成 contentEditable 也一样
  g.state.active = { tagName: "DIV", isContentEditable: true };
  g.fire("scroll");
  assert.equal(g.state.page.y, 120);
  // 焦点一走就按回去——键盘收起来之后 iOS 自己是不还的
  g.state.active = null;
  g.fire("focusout");
  assert.equal(g.state.page.y, 0, "键盘收了还停在上面，那正是她看到的那一幕");
});

test("按钮拿到焦点那一下照样按：她报的就是点了下半屏之后整页上移", () => {
  const g = mkGuard();
  g.state.active = { tagName: "BUTTON" };
  g.state.page.y = 47;
  g.fire("scroll");
  assert.equal(g.state.page.y, 0);
});

test("只听这一层自己的滚动：各页自己那个滚动区一个都不许被误伤", () => {
  // scroll 不冒泡；不加 capture 就只听得到页面这一层。加了 capture 会把
  // 聊天记录、日历时间轴那些正经滚动区全部按回顶上去。
  const i = html.indexOf('window.addEventListener("scroll"');
  const line = html.slice(i, i + 160);
  assert.ok(line.indexOf("capture") < 0, "加了 capture：正经滚动区会被按回顶上");
  assert.match(line, /\{ passive: true \}/);
});

test("日历那一页别再把整页顶高：min-h-0 和外壳的 overflow-hidden", () => {
  // 正文一律 flex-1 min-h-0 overflow-y-auto（施工规则/mobile-ui-layout.md §3）
  assert.match(comp, /h\("div", \{ ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: \{ display: "flex", alignItems: "flex-start" \} \}/);
  // 这里头是写死高度的一张格子——正是「不肯缩」时会把整页顶高的那种东西
  assert.match(comp, /style: \{ flex: 1, display: "flex", height: gridH \+ 90 \}/);
  // 外壳自己兜住
  const shell = comp.slice(comp.indexOf('return h("div", { className: "h-full flex flex-col overflow-hidden"'), comp.indexOf('"data-wk": "head", className: "shrink-0 flex items-center justify-between px-4 pb-2"'));
  assert.ok(shell.length > 0, "日历外壳没有 overflow-hidden");
});
