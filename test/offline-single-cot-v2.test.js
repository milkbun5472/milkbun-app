const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
const group = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)?.[0] || "";

test("single offline writes scene before a retrospective creation note", () => {
  assert.match(engine, /function offlineSingleCotSystemBlock\(think\)/);
  assert.match(engine, /先按本轮线下协议完成 scene 与状态 JSON/);
  assert.match(engine, /不要先列计划、拆解对方话语、安排段落结构或预写情绪走向/);
  assert.match(single, /offlineSingleCotSystemBlock\(cotT\)/);
  assert.match(single, /先完成正文 JSON，再写既定的创作旁注标记块/);
  assert.match(single, /system\.replace\(singleCotBlock, ""\)/);
});

test("group offline keeps the old planning block during the controlled phase", () => {
  assert.match(group, /cotSystemBlock\(cotT\)/);
  assert.doesNotMatch(group, /offlineSingleCotSystemBlock/);
});
