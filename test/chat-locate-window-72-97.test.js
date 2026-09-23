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

test("群聊没有思考格，不许多数", () => {
  const msgs = [{ role: "assistant", content: "a", reasoning: "…" }, { role: "assistant", content: "b" }];
  const c = fakeList(10);
  locateMsgIn(c, 1, msgs, true, { start: 0 });
  assert.equal(hit(c), 2);
});

test("两处都先把窗口撑到目标，再按重画后的起点去数", () => {
  assert.match(src, /const reveal = i => \{ if \(i < winStart\)/);
  const calls = src.match(/onLocate: i => \{ setSearchOpen\(false\); revealMsg\(i\); setTimeout\(\(\) => locateMsgIn\(ref\.current, i, messages, archCount > 0, \{ start: winStartRef\.current/g) || [];
  assert.equal(calls.length, 2, "单聊和群聊得都接上");
});
