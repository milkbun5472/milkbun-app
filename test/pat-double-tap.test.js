// 她 2026-10-02：双击头像拍一拍、拍一拍能撤回、群里也能拍
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
test("单聊：头像双击拍一拍，单击照旧看心声", () => {
  assert.match(comp, /onClick: avTap\(onOpenState\)/);
});
test("拍一拍那行长按出菜单，自己拍的能撤回", () => {
  assert.match(comp, /if \(k === "pat"\) return m && m\.role === "user" \? \[\[\], \[\], \["recall", "del"\]\]/);
});
test("群里：双击成员头像拍TA，用单聊设置里的后缀", () => {
  assert.match(comp, /onPatMember\(cid\)/);
  assert.match(app, /const patGroupMember = \(groupId, charId\) =>/);
  assert.match(app, /onPatMember: cid => patGroupMember\(activeGroup\.id, cid\),/);
  assert.match(app, /char\.patSig \? " " \+ char\.patSig : ""\), ts: Date\.now\(\) \}\]\);/);
});
