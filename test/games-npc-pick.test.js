const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const games = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");

// 群里 2026-10-03：「玩游戏这里能不能加入认识的 npc」
test("小游戏选人能选认识的配角：主角色在前，配角单列一组", () => {
  const seg = app.slice(app.indexOf('screen === "games") body = h(Games, {'), app.indexOf('screen === "fairyGarden")'));
  assert.match(seg, /characters: playChars,/, "又变回 liveChars 了（那份把配角滤掉了）");
  assert.match(games, /chars\.filter\(function \(c\) \{ return !c\.npc; \}\)\.concat\(chars\.filter\(function \(c\) \{ return c\.npc; \}\)\)/);
  assert.match(games, /"认识的配角"/);
});

test("全部游戏都要：小游戏、跑团、小剧场都拿 playChars（主角色在前，配角在后）", () => {
  assert.match(app, /const playChars = characters\.filter\(c => c && !c\.isGroup\)\.sort\(\(a, b\) => \(a\.npc \? 1 : 0\) - \(b\.npc \? 1 : 0\)\);/);
  for (const scr of ["games", "trpg", "theater"]) {
    const a = app.indexOf('screen === "' + scr + '"'), b = app.indexOf("});else if (screen ===", a + 10);
    assert.match(app.slice(a, b), /characters: playChars,/, scr + " 没接上配角");
  }
});
