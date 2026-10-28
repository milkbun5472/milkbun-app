// 查找聊天记录 → 「定位」：聊天只画最近一截（useChatWindow），定位要按真画出来的格子数。
// 读者 2026-09-23：「聊天记录的定位跳转功能好像不太行」。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
const a = src.indexOf("function locateMsgIn("), b = src.indexOf("function ChatSearchSheet(", a);
assert.ok(a > 0 && b > a, "抠不出 locateMsgIn");
const h0 = src.indexOf("const hasReasonRow = "), h1 = src.indexOf("\n", h0);
const locateMsgIn = new Function(src.slice(h0, h1) + "\n" + src.slice(a, b) + "; return locateMsgIn;")();

function fakeList(n) {
  const children = [];
  for (let k = 0; k < n; k++) children.push({ id: k, style: {}, scrollIntoView() { this.hit = true; } });
  return { children };
}
const hit = c => c.children.findIndex(x => x.hit);

test("窗口从第 300 条开始画：第 305 条落在按钮后面第 6 格，不是第 305 格", () => {
  const msgs = Array.from({ length: 500 }, () => ({ role: "user", content: "x" }));
  const c = fakeList(260);
  locateMsgIn(c, 305, msgs, false, { start: 300, single: true });
  assert.equal(hit(c), 1 + 5);
});

test("带思考的消息前面多一格，而且落在气泡上", () => {
  const msgs = [{ role: "assistant", content: "a", reasoning: "…" }, { role: "assistant", content: "b", reasoning: "…" }];
  const c = fakeList(10);
  locateMsgIn(c, 1, msgs, false, { start: 0, single: true });
  assert.equal(hit(c), 3);
});

// 她 2026-10-28：群里「↑ N 条新消息」点了划不上去。群的列表里夹着箭头、药丸、加载按钮、
//   思考链、日期条，数格子必歪——群聊改成直接找气泡的 data-i。
function fakeGroup(ids) {
  const nodes = ids.map(k => ({ k, style: {}, scrollIntoView() { this.hit = true; } }));
  return { nodes, children: [], querySelector(sel) { const m = /data-i="(\d+)"/.exec(sel); return nodes.find(n => String(n.k) === m[1]) || null; } };
}
test("群聊：按 data-i 找那条气泡，不数格子", () => {
  const msgs = Array.from({ length: 10 }, () => ({ role: "assistant", content: "x" }));
  const c = fakeGroup([3, 4, 5, 6]);
  locateMsgIn(c, 5, msgs, true, { start: 0 });
  assert.equal(c.nodes.find(n => n.hit).k, 5);
});
test("群聊：那条是旁白／卡片（没挂 data-i）就落到后面最近那条气泡", () => {
  const msgs = Array.from({ length: 10 }, () => ({ role: "assistant", content: "x" }));
  const c = fakeGroup([3, 6]);
  locateMsgIn(c, 4, msgs, false, { start: 0 });
  assert.equal(c.nodes.find(n => n.hit).k, 6);
});

test("两处都先把窗口撑到目标，再按重画后的起点去数", () => {
  assert.match(src, /const reveal = i => \{ if \((?:!limit && )?i < winStart\)/);
  const calls = src.match(/onLocate: i => \{ setSearchOpen\(false\); revealMsg\(i\); setTimeout\(\(\) => locateMsgIn\(ref\.current, i, messages, archCount > 0, \{ start: winStartRef\.current/g) || [];
  assert.equal(calls.length, 2, "单聊和群聊得都接上");
});
