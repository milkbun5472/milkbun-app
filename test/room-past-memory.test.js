// 她 2026-10-11：群友「过去有一段经历过得不够具体，想再过一遍收到（过去）记忆里」——
//   房间多一格「这里演的是以前的事」+「大概是什么时候」；进记忆的贴「过去」、按那时候记，不挂「几天前」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../js/chat-rooms.js");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const comps = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");

test("这一格默认关着，主聊天没有这一格", () => {
  assert.ok(R.GROUPS.writeback.some(([k]) => k === "pastMemory"));
  Object.keys(R.PRESETS).forEach(k => assert.equal(!!R.PRESETS[k].writeback.pastMemory, false, k));
  assert.equal(!!R.mainRoom("c1").writeback.pastMemory, false);
  assert.match(comps, /!\(draft\.main && k === "pastMemory"\)/);
});

test("开着时：提示词说清在演以前、那时候是几时；时候存得下", () => {
  const room = R.normalize({ id: "r1", name: "那年冬天", writeback: { pastMemory: true }, pastWhen: "三年前的冬天" }, "c1");
  assert.equal(room.pastWhen, "三年前的冬天");
  assert.match(R.prompt(room, [], {}), /【这间房演的是你们以前的事】时间是「三年前的冬天」/);
  assert.doesNotMatch(R.prompt(R.normalize({ id: "r2", name: "平常" }, "c1"), [], {}), /演的是你们以前的事/);
});

test("抽出来的记忆贴「过去」、记那时候、不算没了结；进主线和只在房里两条路都接", () => {
  assert.match(app, /const pastMemEntry = \(e, when\) => \(\{ \.\.\.e, tags: \[\.\.\.new Set\(\[\.\.\.\(e\.tags \|\| \[\]\), "过去"\]\)\], past: true, when: /);
  assert.match(app, /return exOpts\.past \? pastMemEntry\(ent, exOpts\.past\.when\) : ent;/);
  assert.match(app, /\.map\(it => _past \? pastMemEntry\(it, _past\.when\) : it\);/);
});
