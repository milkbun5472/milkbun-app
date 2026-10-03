// 她 2026-10-03 转群友：「能不能让捏的 npc 也能换头像也能进通讯录」→ 通讯录里开一本配角册子，先只管换头像。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const comp = P("js/components.js"), app = P("js/app.js");

test("通讯录有配角入口，打开的是整页册子", () => {
  assert.ok(/entry\("配角"/.test(comp), "通讯录没有配角入口");
  const i = comp.indexOf("function NpcBook(");
  assert.ok(i > 0, "没有 NpcBook");
  const seg = comp.slice(i, comp.indexOf("\nfunction ", i + 10));
  assert.ok(!/h\(Sheet/.test(seg), "配角册子用了半窗");
  assert.ok(/AvatarPicker/.test(seg), "配角册子换不了头像");
});

test("换头像只落在配角身上", () => {
  assert.ok(/onSaveNpcAvatar: \(id, img\) => \{ pC\(p => p\.map\(c => c\.id === id && c\.npc \?/.test(app), "保存头像没限定配角");
});
