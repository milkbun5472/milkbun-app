const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const start = app.indexOf("const forwardTarotToChat = async (session, options) => {");
const end = app.indexOf("// ───────── 擂台", start);
const forward = app.slice(start, end);

test("塔罗小桌转发沿用私聊写入器并保留双方身份与原始时刻", () => {
  assert.ok(start >= 0 && end > start);
  assert.match(forward, /options && options\.table/);
  assert.match(forward, /x\.role === "user" \|\| x\.role === "assistant"/);
  assert.match(forward, /role: x\.role, kind: "tarottable"/);
  assert.match(forward, /ts: Number\(x\.ts\)/);
  assert.match(forward, /pChat\(toChar\.id, p => \[\.\.\.p, intro, \.\.\.moved\]\)/);
});

test("小桌转发不额外调用模型，也不直接写正式记忆", () => {
  const tableBranch = forward.slice(forward.indexOf("if (options && options.table)"), forward.indexOf("const cardsTxt"));
  assert.doesNotMatch(tableBranch, /runProbe|callAI|addMemEntry/);
  assert.match(tableBranch, /return;/);
});
