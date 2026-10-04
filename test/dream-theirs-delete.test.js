const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const dj = fs.readFileSync(__dirname + "/../js/dreamjournal.js", "utf8");
const dl = fs.readFileSync(__dirname + "/../js/dream-loop-shadow.js", "utf8");
test("解梦馆 TA们的梦 每张都能删（删掉的角色留下的也清得掉）", () => {
  assert.ok(/window\.DreamLoop\.removeDream\(d\.key\)\.then\(loadTheirs\)/.test(dj));
  assert.ok(/async function removeDream\(key\)/.test(dl));
  assert.ok(/window\.DreamLoop = \{[^}]*removeDream/.test(dl));
});
