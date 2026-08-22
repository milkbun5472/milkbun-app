"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { wolfPublicThreats, wolfNightIntel } = require("../js/games.js");

test("狼夜里能识别公开查杀狼队友的存活预言家威胁", () => {
  const text = wolfPublicThreats([
    { day: 1, name: "阿青", text: "我是预言家，查杀黑川" },
    { day: 1, name: "路人", text: "我觉得阿青可疑" }
  ], ["黑川"], ["阿青", "黑川", "路人"]);
  assert.match(text, /阿青公开说/);
  assert.match(text, /真预言家威胁极高/);
  assert.doesNotMatch(text, /路人/);
});

test("出局的预言家不再作为当夜刀口威胁", () => {
  const text = wolfPublicThreats([{ day: 1, name: "阿青", text: "我是预言家，查杀黑川" }], ["黑川"], ["黑川"]);
  assert.equal(text, "");
});

test("第一夜机械清空白天历史，禁止脑补已经打过几晚", () => {
  const intel = wolfNightIntel(1, "顾暮发言：昨天我已经站边了", "预言家公开查杀");
  assert.equal(intel.log, "");
  assert.equal(intel.publicThreats, "");
  assert.match(intel.note, /本局第一夜/);
  assert.match(intel.note, /没有白天发言、没有投票/);
  assert.match(intel.note, /绝不能声称某人『前几天\/前几轮发言如何』/);
});

test("第二夜起才允许引用真实公开记录", () => {
  const intel = wolfNightIntel(2, "顾暮发言：我站边阿屿", "阿屿公开跳预言家");
  assert.equal(intel.log, "顾暮发言：我站边阿屿");
  assert.equal(intel.publicThreats, "阿屿公开跳预言家");
  assert.match(intel.note, /第 2 夜/);
});

test("夜间提示同时携带水平差异、公开威胁与非机械盘法", () => {
  const source = fs.readFileSync(path.join(__dirname, "../js/games.js"), "utf8");
  assert.match(source, /真实水平：/);
  assert.match(source, /const nightIntel = wolfNightIntel/);
  assert.match(source, /不是『没死=一定是假』/);
  assert.match(source, /真人的硬公开声明不会经过模型返回的 claims/);
  assert.match(source, /const hardClaim =/);
});
