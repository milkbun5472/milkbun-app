const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
const group = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)?.[0] || "";

test("physical single offline does not inject or expose a creation-note COT", () => {
  assert.match(engine, /function offlineSingleCotSystemBlock\(think\)/);
  assert.match(single, /const requestedCotT = isDigital \? cotThink\(\{ char: char\.name, user: userName \}\) : ""/);
  assert.match(single, /const singleCotBlock = isDigital \? cotSystemBlock\(cotT\) : ""/);
  assert.doesNotMatch(single, /offlineSingleCotSystemBlock\(cotT\)/);
  assert.match(single, /system\.replace\(singleCotBlock, ""\)/);
  assert.match(engine, /OFFLINE_SINGLE_NO_COT_V2_KEY/);
  assert.match(single, /loadOfflineSingleNoCotV2Models\(\)/);
  assert.match(single, /rememberOfflineSingleNoCotV2Model\(cotModelKey\)/);
  assert.match(single, /cotRequested: !!requestedCotT/);
});

test("group offline keeps the old planning block during the controlled phase", () => {
  assert.match(group, /cotSystemBlock\(cotT\)/);
  assert.doesNotMatch(group, /offlineSingleCotSystemBlock/);
});
