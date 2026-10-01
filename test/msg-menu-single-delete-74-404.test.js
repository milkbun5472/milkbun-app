// 长按菜单能单删一条（群里读者 2026-10-02）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");

test("菜单里有「删除」，跟撤回、多选在同一组", () => {
  assert.match(comp, /del: \["删除", "trash"\]/);
  const i = comp.indexOf("function menuItemsForKind("), j = comp.indexOf("function MsgEditSheet(", i);
  assert.ok(i > 0 && j > i);
  const seg = comp.slice(i, j);
  assert.equal((seg.match(/\["multi", "recall", "del"\]/g) || []).length, (seg.match(/"multi"/g) || []).length, "有一类消息的菜单没带删除");
});

test("单聊和群聊都接上了，而且先问一句", () => {
  const n = (comp.match(/act === "del"\) \{[^\n]*requestAppConfirm\("删除这条消息？"/g) || []).length
    + (comp.match(/\} else if \(act === "del"\) \{\n\s*const at = menu;\n\s*if \(onDeleteMessages\) requestAppConfirm\("删除这条消息？"/g) || []).length;
  assert.equal(n, 2);
});
