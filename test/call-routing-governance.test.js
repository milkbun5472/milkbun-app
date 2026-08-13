"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const study = fs.readFileSync("js/study.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const weekly = fs.readFileSync("js/weekly.js", "utf8");
const games = fs.readFileSync("js/games.js", "utf8");

test("一起学轮次导演是本地规则，不再单独调用模型", () => {
  const body = study.match(/function directNv1[\s\S]*?\n  }\n\n  \/\/ ---- 能力档/)?.[0] || "";
  assert.ok(body);
  assert.doesNotMatch(body, /callAI\s*\(/);
});

test("进入论坛不再自动生成楼层", () => {
  assert.match(app, /if \(screen === "forum"\) \{ clearAppNotif\("forum"\); \}/);
  assert.doesNotMatch(app, /if \(screen === "forum"\) \{ autoAmbientRun\("forum"\)/);
});

test("cheap_required 未配置时不再静默回主池，本体文本仍走角色线路", () => {
  assert.match(app, /const bgActive = \(bgApiId && apiProfiles\.find\(p => p\.id === bgApiId\)\) \|\| null/);
  assert.doesNotMatch(app, /const bgActive =[^\n]*\|\| active/);
  assert.match(app, /const bgApiFor = id => apiFor\(id\)/);
  assert.match(app, /if \(!cfg\.autoExtract \|\| !bgActive\) return/);
});

test("周刊媒体腔正常路径批量生成，缺版才单项补洞", () => {
  assert.match(weekly, /async function genMediaBatch/);
  assert.match(weekly, /batch\[v\.id\] \|\| await genMedia/);
});

test("Avalon 组队响应同时携带圆桌发言，缺失才补调用", () => {
  assert.match(games, /\\"talks\\"/);
  assert.match(games, /proposedTalks && proposedTalks\.length \? proposedTalks : await genTableTalk/);
});
