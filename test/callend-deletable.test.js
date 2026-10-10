// 通话记录删不掉（群友 2026-10-11：「群聊通话记录怎么删，记录那里删不掉」）：
// 通话回执跟旁白那一行同一个待遇——长按出菜单（多选、删除），多选里能勾。单聊群聊都一样。
const test = require("node:test");
const assert = require("node:assert/strict");
const cmp = require("node:fs").readFileSync(require.resolve("../js/components.js"), "utf8");

test("通话回执长按出删除，单聊群聊都接上了长按和多选", () => {
  assert.match(cmp, /if \(k === "callend"\) return \[\[\], \[\], \["multi", "del"\]\];/);
  assert.match(cmp, /function CallEndPill\(\{ m, chars, onBg, i, selMode, selected, startPress, endPress, toggleSel \}\)/);
  const uses = cmp.match(/h\(CallEndPill, \{ key: i, i, m, chars: [^}]*selMode, selected: selIds\.includes\(i\), startPress, endPress, toggleSel \}\)/g) || [];
  assert.equal(uses.length, 2);
});
