// 庭院唤醒种子：同行者不过来、提示一直闪；顶栏压住天气和缩放（群友 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const G = fs.readFileSync(path.join(__dirname, "../apps/fairy-garden/game.mjs"), "utf8");
const F = fs.readFileSync(path.join(__dirname, "../js/fairy-garden.js"), "utf8");

test("等他的那句只说一次；等八秒还没到就让他赶到身边", () => {
  assert.match(G, /if\(firstWait\)say\('等同行者走到身边，再一起唤醒种子。'\);/);
  assert.doesNotMatch(G, /acting\.wait=\(acting\.wait\|\|0\)\+dt;say\('等同行者/, "每帧都 say 会一直闪");
  assert.match(G, /if\(acting\.wait>8&&!acting\.pulled\)/);
});

test("游戏每次就绪都重报顶栏高度", () => {
  const i = F.indexOf("ready: () => {");
  assert.match(F.slice(i, i + 600), /g\.setHeadClear\(headHRef\.current\)/);
});
