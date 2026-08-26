const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => path.join(__dirname, "..", "js", f);
const comp = fs.readFileSync(R("components.js"), "utf8");

// 只跑这三个纯函数/组件，不用整套 harness
function load() {
  const t = { ink: "#111", sub: "#555", fog: "#999", line: "#ddd", bg: "#fff", bg2: "#f5f5f5", tint: "#37c" };
  const el = (type, props, ...ch) => ({ type, props, ch });
  const i = comp.indexOf("function chatForwardItems(");
  const seg = comp.slice(i, comp.indexOf("function ForumShareCard("));
  const ctx = { React: { createElement: el }, console };
  vm.createContext(ctx);
  vm.runInContext('const h=React.createElement;const useTheme=()=>(' + JSON.stringify(t) + ');'
    + 'const F_BODY="b",F_DISPLAY="d";function Sheet(p){return h("Sheet",p);}\n' + seg, ctx);
  return ctx;
}

// 她 2026-08-26 截图：转发过去的六条原话直接糊成一堵墙。微信是卡片 + 两行预览 + 点开看全部。
test("标题按出现过几个人算，老消息不用迁移也显示得对", () => {
  const { chatForwardTitle } = load();
  assert.equal(chatForwardTitle({ forward: { items: [{ name: "裴照川", text: "a" }, { name: "裴照川", text: "b" }] } }), "裴照川的聊天记录");
  assert.equal(chatForwardTitle({ forward: { items: [{ name: "Lisa", text: "a" }, { name: "裴照川", text: "b" }] } }), "Lisa和裴照川的聊天记录");
  assert.equal(chatForwardTitle({ forward: { items: [{ name: "A", text: "1" }, { name: "B", text: "2" }, { name: "C", text: "3" }] } }), "群聊的聊天记录");
  assert.equal(chatForwardTitle({ forward: {} }), "聊天记录");
});

test("只剩正文的老消息，从文本里还原得回来", () => {
  const { chatForwardItems, chatForwardTitle } = load();
  const m = { content: "【转发的聊天记录】\n裴照川：你转，你现在就转\n裴照川：顺便替我告诉他" };
  const items = chatForwardItems(m);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "裴照川");
  assert.equal(items[0].text, "你转，你现在就转");
  assert.equal(chatForwardTitle(m), "裴照川的聊天记录");
});

test("卡片只露两行，多的收进「…」", () => {
  const { ChatForwardCard } = load();
  const items = Array.from({ length: 6 }, (_, i) => ({ name: "裴照川", text: "第" + i + "句" }));
  const texts = [];
  (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "string") return texts.push(x);
    if (x.type !== undefined) { walk(x.ch); walk(x.props && x.props.children); } })(ChatForwardCard({ m: { forward: { items } }, isU: true, onOpen: () => {} }));
  assert.ok(texts.includes("裴照川: 第0句"));
  assert.ok(texts.includes("裴照川: 第1句"));
  assert.ok(!texts.some(x => x.indexOf("第2句") >= 0), "第三条起不该出现在卡片上");
  assert.ok(texts.includes("…"));
  assert.ok(texts.includes("聊天记录"), "底下那行标识");
});

test("点开的面板给全部", () => {
  const { ChatForwardSheet } = load();
  const items = Array.from({ length: 6 }, (_, i) => ({ name: "裴照川", text: "第" + i + "句" }));
  const texts = [];
  (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "string") return texts.push(x);
    if (x.type !== undefined) { walk(x.ch); walk(x.props && x.props.children); } })(ChatForwardSheet({ m: { forward: { items } }, onClose: () => {} }));
  for (let i = 0; i < 6; i++) assert.ok(texts.includes("第" + i + "句"), "缺第" + i + "句");
});

// 单聊和群聊两处都得接上——只接一处正是「这一层只写在一处」那个老形状
test("单聊和群聊都渲染成卡片", () => {
  // 三处：单聊气泡、群聊气泡、搜索里的类型标签
  assert.equal((comp.match(/if \(m\.kind === "chatforward"\) return/g) || []).length, 2, "单聊、群聊各一处");
  assert.equal((comp.match(/h\(ChatForwardCard, \{/g) || []).length, 2);
  assert.equal((comp.match(/h\(ChatForwardSheet, \{/g) || []).length, 2, "两边各要有自己的详情面板");
  assert.equal((comp.match(/const \[fwdView, setFwdView\] = useState\(null\)/g) || []).length, 2);
});

test("搜索里也认得这类消息", () => {
  assert.match(comp, /m\.kind === "chatforward" \? "💬聊天记录"/);
});
