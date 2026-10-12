// 真心话大冒险里角色把她当陌生人（群友 2026-10-12）：关系铁律要把真人玩家除开，开了注入聊天要真带进出题那一步
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "../js/games.js"), "utf8");
test("关系铁律把真人玩家除开", () => {
  assert.match(src, /【真人玩家不是陌生人】/);
  assert.match(src, /互不相识】，只是被这局游戏临时凑到一起（真人玩家除外/);
});
test("注入最近聊天时，近况跟着上场角色进 tdDesc，续局也留着", () => {
  assert.match(src, /recent: inject \? String\(props\.recentChatFor\(c\.id\)/);
  assert.match(src, /p\.recent \? "\\n【和她的近况】\\n" \+ p\.recent/);
  assert.match(src, /recent: p\.recent \|\| ""/);
});
test("一屋子熟人：关系网（x_rels）里连着的带进人设，铁律也认它", () => {
  assert.match(src, /loadJSON\("x_rels", \{\}\)/);
  assert.match(src, /p\.ties \? "\\n【关系网里连着的】" \+ p\.ties/);
  assert.match(src, /只认人设里白纸黑字写明的和【关系网里连着的】那一行/);
  assert.match(src, /ties: p\.ties \|\| ""/);
});
test("近况也带开了记忆互通的群（主要在群里处的角色）", () => {
  const app = fs.readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  const i = app.indexOf("recentChatFor: (charId) => {"), body = app.slice(i, i + 1200);
  assert.ok(i > 0);
  assert.match(body, /gsFor\(g\.id\)\.memoryInterop && \(g\.memberIds \|\| \[\]\)\.includes\(charId\)/);
  assert.match(body, /sort\(\(a, b\) => a\.ts - b\.ts\)\.slice\(-16\)/);
});
