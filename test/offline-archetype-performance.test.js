const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

test("dense romantic archetypes get an independent same-response revision gate", () => {
  assert.match(engine, /function offlineArchetypePerformanceRisk\(persona\)/);
  assert.match(engine, /return clusterCount >= 2 \|\| hitCount >= 4/);
  assert.match(engine, /function offlineArchetypeSelfReviseProtocol\(shape\)/);
  assert.match(engine, /角色卡里的强烈标签是行为原因，不是旁白任务/);
  assert.match(engine, /本场与角色面对面互动的用户始终称为「你」/);
  assert.match(engine, /不要把它当作角色的固定签名每轮补一次/);
  assert.match(engine, /const archetypePerformanceRisk = !isDigital && offlineArchetypePerformanceRisk\(char && char\.persona\)/);
  assert.match(engine, /const singlePassRevisionRequested = explicitRevisionRequested \|\| archetypeRevisionRequested/);
  assert.doesNotMatch(engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "", /await offlineRewriteScene\(/);
});
