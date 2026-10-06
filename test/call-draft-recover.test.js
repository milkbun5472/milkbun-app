// 她 2026-10-06：「语音通话的时候要是卡掉了整个记录都没了」——通话边打边存，下次开机补回执。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("每多一句就存草稿", () => {
  assert.match(app, /saveJSON\("x_callDraft", \{/);
  assert.match(app, /\}, \[call && call\.msgs\]\);/);
});
test("正常挂断收走草稿", () => {
  const i = app.indexOf("const endCall = ");
  const j = app.indexOf("callRef.current = null;", i);
  assert.ok(app.slice(i, j).includes('localStorage.removeItem("x_callDraft")'));
});
test("开机补一张中途断了的回执，同一通还在打就不补", () => {
  assert.match(app, /中途断了 · 时长/);
  assert.match(app, /callRef\.current\.sessionId === d\.sessionId\) return;/);
  assert.match(app, /kind: "callend", callMode: d\.mode/);
});
