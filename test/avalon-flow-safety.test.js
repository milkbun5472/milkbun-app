"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/games.js"), "utf8");
const { avalonBoard } = require("../js/games.js");

test("阿瓦隆连续否决计数同步更新并保留公开进度", () => {
  assert.match(source, /setVoteTrack\(vt2\); vtRef\.current = vt2/);
  assert.match(source, /连续否决：" \+ vt2 \+ "\/5/);
  assert.match(source, /vt2 >= 5/);
});

test("关键任务与逐人票型不会被近期闲聊挤掉", () => {
  assert.match(source, /投票明细：/);
  assert.match(source, /const core = all\.filter/);
  assert.match(source, /core\.concat\(recent\)/);
});

test("AI 组队和刺杀接口失败都有合法流程兜底", () => {
  assert.match(source, /已由法官补一支合法队伍/);
  assert.match(source, /const fallback = \[ld\.name\]/);
  assert.match(source, /tp\.side !== "good"/);
  assert.match(source, /已由法官随机锁定一名好人/);
});

test("派西维尔与莫甘娜成对出现且特殊槽位超限会阻止开局", () => {
  for (let i = 0; i < 20; i++) {
    const roles = avalonBoard(5, { percival: true, mordred: false, oberon: false });
    assert.ok(roles.includes("percival"));
    assert.ok(roles.includes("morgana"));
  }
  assert.match(source, /const avOverflow =/);
  assert.match(source, /特殊坏人槽位不够/);
  assert.match(source, /!avOverflow/);
});

test("投票和任务生成彻底失败也不会卡住观战流程", () => {
  assert.match(source, /投票生成失败，法官已用兜底票型推进/);
  assert.match(source, /setBusy\(false\); goQuest\(tm, qn, li\)/);
  assert.match(source, /任务生成失败，AI 队员本轮按成功票结算/);
  assert.match(source, /resolveQuest\(tm, qn, li, userFails \|\| 0\)/);
});

test("续局横幅比分按传入结果计算而不是旧闭包", () => {
  assert.match(source, /const ckGood = \(resultsArr \|\| \[\]\)/);
  assert.match(source, /ckGood \+ " 成 " \+ ckEvil/);
});
