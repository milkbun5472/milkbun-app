const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
const group = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)?.[0] || "";

// v52.66 A/B 定为长期行为：普通单人线下完全不注入创作小稿/COT；数字模式沿用 cotSystemBlock。
test("normal single offline requests no creation-note COT; digital keeps the legacy block", () => {
  assert.match(single, /const requestedCotT = isDigital \? cotThink\(/);
  assert.match(single, /const singleCotBlock = isDigital \? cotSystemBlock\(cotT\) : ""/);
  assert.doesNotMatch(engine, /offlineSingleCotSystemBlock\(/);
  assert.match(single, /先完成正文 JSON，再写既定的创作旁注标记块/);
  assert.match(single, /system\.replace\(singleCotBlock, ""\)/);
  assert.match(engine, /OFFLINE_SINGLE_NO_COT_V2_KEY/);
  assert.match(single, /loadOfflineSingleNoCotV2Models\(\)/);
  assert.match(single, /rememberOfflineSingleNoCotV2Model\(cotModelKey\)/);
  assert.match(single, /cotRequested: !!requestedCotT/);
});

test("group offline keeps the old planning block during the controlled phase", () => {
  assert.match(group, /cotSystemBlock\(cotT\)/);
});
