"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/games.js"), "utf8");

test("真心话大冒险跨新局保存最近题目并禁止近义复读", () => {
  assert.match(source, /tod_prompt_history_v1/);
  assert.match(source, /function rememberTDPrompt/);
  assert.match(source, /跨局最近出过的题（禁止重复或近义改写）/);
  assert.match(source, /all\.slice\(-120\)/);
});

test("连续两轮没有大冒险时下一轮强制大冒险", () => {
  assert.match(source, /recent\.length >= 2 && recent\.every/);
  assert.match(source, /choice = "大冒险"/);
  assert.match(source, /const choice = plan\.choice/);
  assert.match(source, /out\.choice !== plan\.choice \|\| !tdPromptMatchesChoice/);
  assert.match(source, /不能只改 choice 标签/);
});

test("题型主题轮换且大冒险必须是可执行行动", () => {
  assert.match(source, /const TD_THEMES =/);
  assert.match(source, /现场互动/);
  assert.match(source, /反向角色扮演/);
  assert.match(source, /大冒险必须是当场能演出来的具体行动/);
  assert.match(source, /人设只决定出题口吻和完成方式/);
});
