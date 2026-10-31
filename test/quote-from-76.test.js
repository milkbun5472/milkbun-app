// 引用块带上「引的是谁的话」（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const a = c.indexOf("function quoteFromOf("), b = c.indexOf("function msgStickEl(");
const f = new Function(c.slice(a, b) + "; return quoteFromOf;")();
test("往前找原话认出是谁说的，群里引成员直接是 ta", () => {
  const L = [{ role: "user", content: "今天好累" }, { role: "assistant", content: "早点睡" }, { role: "assistant", content: "x", replyTo: "今天好累" }];
  assert.equal(f(L, 2, L[2]), "me");
  assert.equal(f(L, 3, { role: "user", replyTo: "早点睡" }), "ta");
  assert.equal(f([], 0, { replyTo: "随便", replyToSenderId: "c1" }), "ta");
  assert.equal(f(L, 2, { role: "user" }), "");
});
test("单聊、群聊两处引用块都挂上", () => {
  assert.equal((c.match(/"data-from": quoteFromOf\(messages, i, m\) \|\| undefined/g) || []).length, 2);
});
