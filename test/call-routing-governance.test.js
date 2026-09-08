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

test("后台未单独选择时跟随主模型，显式选择独立；本体仍走角色线路", () => {
  const declaration = app.match(/const bgActive =[^\n]+;/)[0];
  const resolve = new Function("bgApiId", "apiProfiles", "active", declaration + "return bgActive;");
  const main = {id: "main", baseUrl: "https://main.invalid", model: "main"};
  const bg = {id: "bg", baseUrl: "https://bg.invalid", model: "background"};
  assert.equal(resolve(null, [main, bg], main), main);
  assert.equal(resolve("", [main, bg], bg), bg);
  assert.equal(resolve("bg", [main, bg], main), bg);
  assert.equal(resolve("missing", [main, bg], main), null);
  assert.equal(resolve(null, [], undefined), null);
  assert.match(app, /saveJSON\("x_bgApi", id\)/);
  assert.match(app, /const bgApiFor = id => apiFor\(id\)/);
  assert.match(app, /if \(!cfg\.autoExtract \|\| !bgActive\) return/);
});

test("缺少模型时调用入口明确报错，不访问网络或读取空baseUrl", async () => {
  const engine = fs.readFileSync("js/engine.js", "utf8");
  const start = engine.indexOf("async function callAI(");
  const end = engine.indexOf("\n}", start) + 2;
  const call = new Function(engine.slice(start, end) + ";return callAI;")();
  await assert.rejects(call(null, "", []), /没有可用的文字模型/);
  await assert.rejects(call(undefined, "", []), /没有可用的文字模型/);
});

test("周刊媒体腔正常路径批量生成，缺版才单项补洞", () => {
  assert.match(weekly, /async function genMediaBatch/);
  assert.match(weekly, /batch\[v\.id\] \|\| await genMedia/);
});

test("Avalon 组队响应同时携带圆桌发言，缺失才补调用", () => {
  assert.match(games, /\\"talks\\"/);
  assert.match(games, /proposedTalks && proposedTalks\.length \? proposedTalks : await genTableTalk/);
});
