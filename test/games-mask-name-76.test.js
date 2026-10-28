// 群友 2026-10-29：真心话大冒险里角色只叫主面具的名字，没叫他认识的那张面具
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const games = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("小游戏按上桌的人认的面具叫她", () => {
  assert.match(app, /profileFor: profileFor,\n    worldbook: loreForContext\("creative"/, "app 没把 profileFor 递给小游戏");
  assert.match(games, /const tableProfile = \(function \(\) \{/);
  assert.match(games, /ps\.every\(function \(x\) \{ return x === ps\[0\]; \}\) \? ps\[0\] : props\.profile/, "认的不一样时回主面具");
  assert.doesNotMatch(games, /profile: props\.profile, recentChatFor: props\.recentChatFor/, "引擎那几处还在用主面具");
});
