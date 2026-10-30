const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("通讯录长按收起：记在档案上，消息列表和通讯录不出现，自动的活都停", () => {
  assert.match(app, /const shelvedChar = id =>/);
  assert.match(app, /!maskRested\(charId\) && !shelvedChar\(charId\) &&/);
  assert.match(app, /characters: liveChars\.filter\(c => !c\.shelved\)\.map\(chatFace\)/);
  assert.match(comp, /"收起来（档案和聊天都留着）"/);
  assert.match(comp, /"收起来的人（" \+ shelvedChars\.length/);
  assert.match(ui, /"已收起 · 放回来"/);
});
test("消息列表长按照旧是置顶", () => {
  assert.match(comp, /if \(npc\) setRowMenu\(npc\); else onTogglePin && onTogglePin\(id\);/);
});
