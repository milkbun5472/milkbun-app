// 左滑引用（群里读者 2026-10-02：「像 QQ 一样往左滑就引用啊，不需要长按了」）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");

test("滑和长按住在同一只钩子里，不另起一份量手指的", () => {
  const i = comp.indexOf("function useLongPressMenu("), j = comp.indexOf("function TransTextState(", i);
  assert.ok(i > 0 && j > i, "抠不出 useLongPressMenu");
  const seg = comp.slice(i, j);
  assert.match(seg, /if \(Math\.abs\(dy\) > SWIPE_QUOTE_MAX_DY\) \{ resetSwipe\(\); return; \}/, "上下滚动会被认成滑");
  assert.match(seg, /if \(dx <= -SWIPE_QUOTE_PX\) \{/);
  assert.match(seg, /swipeIdx\.current = swipeRef\.current \? idx : null;/, "没开左滑的调用点（一起读那几处）也被挂上了");
});

test("单聊、群聊都接上，只给本来能引用的消息", () => {
  const calls = comp.match(/useLongPressMenu\(setMenu, \{ onSwipeLeft: i => \{[\s\S]{0,260}?menuItemsForKind\(mm, false\)\.some\(g => g\.indexOf\("quote"\) >= 0\)/g) || [];
  assert.equal(calls.length, 2);
  assert.match(comp, /setQuoted\(window\.GroupQuote \? window\.GroupQuote\.makeSelection\(mm, i, meName\)/, "群里没走 GroupQuote 那个形状");
});
