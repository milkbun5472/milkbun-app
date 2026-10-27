const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("聊天设置每一节都走 show()，搜得到（她 2026-10-27：搜「字符」搜不出来）", () => {
  const i = c.indexOf("  const show = (tab, props, ...children) =>"), j = c.indexOf("\nfunction ", i);
  const body = c.slice(i, j);
  assert.match(body, /onDrawLucky \? show\("look", \{ title: "我们的幸运字符"/);
  assert.match(body, /show\("know", \{ title: "世界书 · TA 用哪几条"/);
  assert.ok(!/settingsTab === "[a-z]+" &&[^\n]{0,80}\? h\(SettingSection/.test(body), "还有一节绕过 show() 直接画");
});
