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

// 单次响应内自修必须是全线下共享的一份文本，不再焊死在单聊线下里（Lisa 2026-08-18）
test("自修协议抽成共享函数，小剧场走同一套", () => {
  const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  const th = fs.readFileSync(path.join(__dirname, "..", "js", "theater.js"), "utf8");
  assert.match(eng, /function offlineSelfReviseProtocol\(shape, archetypeGuard, narr\)/);
  assert.equal((eng.match(/本轮单次响应内自修/g) || []).length, 1, "自修文本只许有一份");
  assert.match(eng, /explicitRevisionRequested\s*\? offlineSelfReviseProtocol\(null, archetypeRevisionRequested, session\.narr\)/);
  assert.match(th, /offlineSelfReviseProtocol\(/, "小剧场要用同一份自修协议");
  assert.match(th, /offlineRegisterTransition\(/, "小剧场要用同一套跨界判定");
  assert.match(th, /selfRevise && p\.draftScene && !String\(p\.scene \|\| ""\)\.trim\(\)/, "终稿缺失不许拿草稿顶上");
});
