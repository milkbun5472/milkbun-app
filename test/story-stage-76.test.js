// 故事接龙不写成流水账（2026-11-01）：每句知道故事走到哪、开头埋了什么；抽到的词是道具
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const stage = new Function(src.slice(src.indexOf("function storyTotalTurns"), src.indexOf("  function storyIsLast")) + "; return storyStage;")();
test("按写到第几句分段", () => {
  const st = { players: [1, 2, 3, 4, 5, 6], laps: 3, lines: [] };
  assert.match(stage(st), /第 1 句，一共 18 句。故事刚开头/);
  st.lines = Array(9).fill(0); assert.match(stage(st), /故事在中段/);
  st.lines = Array(14).fill(0); assert.match(stage(st), /快到尾声/);
  st.lines = Array(16).fill(0); assert.match(stage(st), /下一句就是结尾/);
});
test("提示里带着开头那件事和段落，词是顺手出现的东西", () => {
  assert.match(src, /这篇故事从开头那一句埋下的事出发：「" \+ state\.opener \+ "」/);
  assert.match(src, /\+ storyStage\(state\)/);
  assert.match(src, /一笔带过就够；这一句真正要做的是把故事往前推一步/);
});
