// 聊天里的表情面板只摆全局的和勾给这个人的（她 2026-10-16）
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
test("emotePacksForChar 认 charId", () => {
  const i = app.indexOf("const emotePacksForChar = charId =>"), seg = app.slice(i, i + 900);
  assert.ok(/pk\.global \|\| !\(pk\.charIds \|\| \[\]\)\.length \|\| \(pk\.charIds \|\| \[\]\)\.map\(String\)\.includes\(String\(charId\)\)/.test(seg));
});
