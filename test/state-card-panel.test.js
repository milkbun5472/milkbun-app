const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("头像藏了时状态卡入口在消息底下那一行，不加新格子（她 2026-10-26）", () => {
  assert.doesNotMatch(comp, /\["state", "状态卡"/);
  assert.match(comp, /function chatMsgFoot\(t, m, sub, dot, onState\)/);
  assert.equal((comp.match(/const msgFoot = \(i, m, sub\) =>/g) || []).length, 2);
  assert.equal((comp.match(/chatMsgFoot\(t, m, sub, sayDot\(i, m\)/g) || []).length, 2);
  assert.match(comp, /"data-wk": "stlink"[\s\S]{0,140}display: "none"/);
  assert.match(comp, /who && canPeek\(who\) \? \(\) => onOpenMemberState\(who\.id\) : null/);
});
test("排版选「头像 · 不显示」才露出来，只在一串最后一条", () => {
  const i = comp.indexOf("const CHAT_LAYOUT_DEFAULT"), j = comp.indexOf("\n}\n", comp.indexOf("function chatLayoutCSS")) + 3;
  const css = new Function(comp.slice(i, j) + "; return chatLayoutCSS;")();
  const j2 = s => Array.isArray(s) ? s.join("") : String(s);
  assert.match(j2(css({ avatar: "none" })), /\[data-wk="msg"\]\[data-last="1"\] \[data-wk="stlink"\]\{display:inline-flex !important;\}/);
  assert.doesNotMatch(j2(css({ avatar: "all" })), /stlink/);
});
