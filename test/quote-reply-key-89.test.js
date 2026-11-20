// 她 2026-11-18：引用着在输入框打字、直接点回复键，只发了字没带引用条
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");
test("单聊回复键：引用着就带上引用条再让 TA 回", () => {
  const i = comp.indexOf("  const reply = (pending) => {"), body = comp.slice(i, comp.indexOf("  };", i));
  assert.match(body, /pending && quoted && chatMode === "chat"/);
  assert.match(body, /replyTo: quoted[^\n]*setQuoted\(null\); onReply\(""\);/);
});
