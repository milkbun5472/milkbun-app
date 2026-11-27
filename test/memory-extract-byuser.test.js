// 她拿他手机替他发的那条，记忆抽取也要看得出不是他说的（群友 2026-11-27）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
function body(name) {
  const i = src.indexOf("async function " + name + "(");
  assert.ok(i >= 0, name);
  return src.slice(i, src.indexOf("\n}\n", i));
}
test("单人记忆抽取：byUser 那条挂上 bySomeoneElseMark", () => {
  assert.match(body("extractMemories"), /m\.byUser \? bySomeoneElseMark\(uName, charName\)/);
});
test("群记忆抽取：byUser 那条挂上 bySomeoneElseMark", () => {
  assert.match(body("extractGroupMemories"), /m\.byUser \? bySomeoneElseMark\(uName,/);
});
