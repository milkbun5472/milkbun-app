const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const c = fs.readFileSync("js/components.js", "utf8");
const f = new Function(c.slice(c.indexOf("function offRoundTag"), c.indexOf("function OfflineMode(")) + ";return offRoundTag;")();
test("按一次生成算一轮，多人线下一轮好几拍只算一轮", () => {
  assert.equal(f({ msgs: [] }), "");
  assert.equal(f({ msgs: [{ role: "user", content: "a", ts: 0 }, { role: "char", content: "b", ts: 10000 }, { role: "char", content: "c", ts: 10400 }, { role: "user", content: "d", ts: 30000 }, { role: "char", content: "e", ts: 40000 }] }), " · 第 2 轮");
  assert.equal(f({ msgs: [{ role: "char", content: "b", ts: 0 }, { role: "char", content: "c", ts: 60000 }] }), " · 第 2 轮");
  assert.equal((c.match(/offRoundTag\(activeSession\)/g) || []).length, 2);
});
