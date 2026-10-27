const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
const cut = name => { const i = eng.indexOf(name); return eng.slice(i, eng.indexOf("\n}\n", i) + 2); };
const load = raw => new Function("callAI", "parseJSONLoose", cut("function npcGenderOf(") + cut("function npcSysOf(") + cut("async function generateNpc(") + cut("async function generateNpcs(") + ";return generateNpcs;")(async () => raw, s => { try { return JSON.parse(s); } catch (e) { return null; } });
test("一次生成几位配角：同一次调用、几位都建上（群友 2026-10-26）", async () => {
  const g = load(JSON.stringify({ npcs: [{ name: "甲", brief: "你是甲……", relFromHost: "a", relToHost: "b" }, { name: "乙", brief: "你是乙……" }] }));
  const r = await g({}, { name: "主" }, "他的两个兄弟", [], 2);
  assert.deepEqual(r.map(x => x.name), ["甲", "乙"]);
  const sys = new Function(cut("function npcSysOf(") + ";return npcSysOf;")()({ name: "主" }, "", [], 3);
  assert.match(sys, /这次要 3 位，彼此是不同的人/); assert.match(sys, /用户没写，照主角色的人设挑几位/); assert.match(sys, /⚠️TA不认识用户/);
  assert.match(app, /const list = await generateNpcs\(p, host, ask, npcsOf\(hostId\)\.map\(c => c\.name\), n, loreForContext\("chat", \[hostId\]/);
  assert.match(app, /onCreateNpc: \(hostId, ask, n\) => createNpc\(hostId, ask, n\)/);
  assert.match(ui, /"data-wk": "tiesnpccount"/); assert.match(ui, /onCreateNpc\(c\.meChar, v, c\.npcCount \|\| 1\)/);
});

test("配角性别单独一栏：只认 他／她，别的算 TA（她 2026-10-26）", async () => {
  const gen = load('{"npcs":[{"name":"甲","brief":"你是甲，' + "x".repeat(30) + '","relFromHost":"a","relToHost":"b","gender":"她"},{"name":"乙","brief":"你是乙，' + "x".repeat(30) + '","relFromHost":"a","relToHost":"b","gender":"男"}]}');
  const out = await gen({}, { name: "主" }, "", [], 2);
  assert.deepEqual(out.map(r => r.gender), ["她", "TA"]);
  assert.match(app, /gender: r\.gender \|\| "TA"/);
});
