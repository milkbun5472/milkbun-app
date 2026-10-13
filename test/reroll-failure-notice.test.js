const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 群友 2026-10-13：两个角色同时发，一个报「无可用渠道」；换了线路、TA 也回了，刚回的那几条却全没了。
// 重 Roll 是从那一条起往后整段截掉——「发送失败」那行压在中间时，后面成功的回复跟着一起被删。
test("在「发送失败」那行上重 Roll：只撤它自己，后面的回复一条不动", () => {
  const i = app.indexOf("if (window.ChatContextFilter && window.ChatContextFilter.isFailureNotice(m)) {"), j = app.indexOf("const turnId = m.turnId;", i);
  assert.ok(i > 0 && j > i);
  const seg = app.slice(i, j);
  assert.match(seg, /window\.ChatContextFilter\.isFailureNotice\(m\)/, "没先认失败那一行");
  assert.match(seg, /pChat\(threadKey, p => p\.filter\(x => x !== m/, "不是只撤它自己");
  assert.ok(seg.indexOf("truncateChatBranch") < 0, "失败那行又走了截尾");
});
