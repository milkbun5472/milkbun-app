const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("悬浮球带时间感知：单聊改角色那层，别处改全局", () => {
  const fn = src.slice(src.indexOf("function ModelQuickSwitch("), src.indexOf("function idbAudioOpen("));
  assert.ok(fn.includes("clockRow") && fn.includes("CLOCK_OPTS"));
  const call = src.slice(src.indexOf("h(ModelQuickSwitch, {"), src.indexOf("newGroupOpen && "));
  assert.ok(/patchChatSetting\(activeChar\.id, \{ timeAwareMode: v \}\)/.test(call));
  assert.ok(/saveJSON\("x_prefs", p\)/.test(call));
});
