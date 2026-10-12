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
