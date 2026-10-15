// 出戏：先写一段带括号的分析、再给 {"reply":…}，照样认出来（她 2026-10-16 截图）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
const a = src.indexOf("function extractJSONKey("), b = src.indexOf("\nfunction ", src.indexOf("function extractJSON(raw)") + 10);
const ra = src.indexOf("function repairJSON("), rb = src.indexOf("\nfunction ", ra + 10);
const f = new Function(src.slice(ra, rb) + "\n" + src.slice(a, b) + "\nreturn extractJSONKey;")();
test("前面那段话里的括号不抢走 reply", () => {
  const raw = 'The user [maybe] finds {this} pattern rigid.\n\n{"reply":"有两个原因","directive":"别套句式","replaces":[3],"soon":null,"refused":false}';
  const d = f(raw, "reply");
  assert.equal(d.reply, "有两个原因");
  assert.deepEqual(d.replaces, [3]);
  assert.equal((src.match(/extractJSONKey\(raw, "reply"\)/g) || []).length, 2);
});
