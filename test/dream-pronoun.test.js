// 梦境提示词写明做梦人和客串的称呼（群里 2026-11-04：女角色梦里被写成「他」）
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "dream.js"), "utf8");
test("会话存 charTa、客串存 ta", () => {
  assert.equal((s.match(/charTa: typeof CharacterPronoun !== "undefined" \? CharacterPronoun\.ta\(c\)/g) || []).length, 2);
  assert.match(s, /ta: typeof CharacterPronoun !== "undefined" \? CharacterPronoun\.ta\(g\)/);
});
test("提示词里带称呼", () => {
  assert.match(s, /taWord\(session\.charTa\)/);
  assert.match(s, /taWord\(g\.ta\)/);
});
