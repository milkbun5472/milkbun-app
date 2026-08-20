const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

test("dense romantic archetypes get an independent same-response revision gate", () => {
  assert.match(engine, /function offlineArchetypePerformanceRisk\(persona\)/);
  assert.match(engine, /return clusterCount >= 2 \|\| hitCount >= 4/);
  assert.match(engine, /function offlineArchetypeSelfReviseProtocol\(shape, narr\)/);
  assert.match(engine, /角色卡里的强烈标签是行为原因，不是旁白任务/);
  assert.match(engine, /本场设置要求用第二人称『你』称呼对方/);
  assert.match(engine, /本场设置要求用第三人称称呼对方/);
  assert.match(engine, /不要擅自改回『你』/);
  assert.doesNotMatch(engine, /称对方为『你』。把当前互动写成连续的场景正文/);
  assert.match(engine, /不要把它当作角色的固定签名每轮补一次/);
  assert.match(engine, /它们是叙述声纹，不是原型包装/);
  assert.match(engine, /不得把有疏密和气口的叙事压成等距的动作记录/);
  assert.match(engine, /const archetypePerformanceRisk = !isDigital && offlineArchetypePerformanceRisk\(char && char\.persona\)/);
  assert.match(engine, /const singlePassRevisionRequested = explicitRevisionRequested \|\| archetypeRevisionRequested/);
  assert.doesNotMatch(engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "", /await offlineRewriteScene\(/);
});
