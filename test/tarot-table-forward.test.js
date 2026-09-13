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
  // v67.67：这一串最前面多了【那张卡】——牌和解析原来一个字都没进去
  //（她 2026-09-13 带截图报的）。写入器、身份、原始时刻这三样一个字没动。
  // v67.68：落点可以是他的某一间房了，所以键从 toChar.id 换成算好的 chatKey
  assert.match(forward, /pChat\(chatKey, p => \[\.\.\.p, cardMsg, intro, \.\.\.moved\]\)/);
});

test("小桌转发不额外调用模型，也不直接写正式记忆", () => {
  const tableBranch = forward.slice(forward.indexOf("if (options && options.table)"), forward.indexOf("const cardsTxt"));
  assert.doesNotMatch(tableBranch, /runProbe|callAI|addMemEntry/);
  assert.match(tableBranch, /return;/);
});
