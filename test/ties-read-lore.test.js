const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("关系页的两处模型调用都读世界书（群友 2026-10-26）", () => {
  assert.match(app, /generateRelation\(p, a, b, \{ via: viaBits\.join\("；"\), world: loreForContext\("chat", \[a\.id, b\.id\]/);
  assert.match(app, /generateNpcs\(p, host, ask, npcsOf\(hostId\)\.map\(c => c\.name\), n, loreForContext\("chat", \[hostId\]/);
  assert.match(eng, /function npcSysOf\(hostChar, ask, takenNames, n, world\)/);
  assert.match(eng, /generateNpc\(p, hostChar, ask, takenNames, world\)/);
  assert.match(eng, /【这个世界（世界书，照它判断两人碰不碰得上）】/);
});
