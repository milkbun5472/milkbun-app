"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const engine = fs.readFileSync("js/engine.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");

test("真实聊天留下可读但不持久化的最终召回快照", () => {
  const start = engine.indexOf("function noteMemoryRecallSnapshot");
  const end = engine.indexOf("function retrieveMemories", start);
  assert.ok(start >= 0 && end > start);
  const sandbox = { window: {}, Object, JSON, Date };
  vm.createContext(sandbox);
  vm.runInContext(engine.slice(start, end), sandbox);
  const note = vm.runInContext("noteMemoryRecallSnapshot", sandbox);
  note("c1", { mode: "hybrid", picked: [{ id: "m1", text: "真的被想起来了" }] }, { source: "background" });
  assert.equal(sandbox.window.MemoryRecallSnapshot.get("c1"), null, "后台重建不能冒充真实收据");
  note("c1", { mode: "hybrid", picked: [{ id: "m1", text: "真的被想起来了" }] }, { source: "chat" });
  const row = sandbox.window.MemoryRecallSnapshot.get("c1");
  assert.equal(row.mode, "hybrid");
  assert.equal(row.picked[0].text, "真的被想起来了");
  assert.equal(Object.prototype.hasOwnProperty.call(row, "queryText"), false, "快照不保存用户查询正文");
});

test("上下文诊断只读重建且展示上一轮具体命中", () => {
  assert.match(app, /buildBundle\(ctxFor\(c, \{ debug: true \}\)\)/);
  assert.match(app, /touch: !\(ctxOpts && ctxOpts\.debug === true\)/);
  assert.match(screens, /上一轮真实召回/);
  assert.match(screens, /MemoryRecallSnapshot\.get\(id\)/);
  assert.match(screens, /向量参与打分/);
});

test("单人通话用电话本轮文本做向量召回并留下真实聊天收据", () => {
  assert.match(app, /const recallText = ctxOpts && typeof ctxOpts\.queryText === "string" \? ctxOpts\.queryText : recentChatText\(char\)/);
  assert.match(app, /const callQuery = withUser\.slice\(-12\)/);
  assert.match(app, /await primeQueryVec\(callQuery\)/);
  assert.match(app, /ctxFor\(char, \{ chat: true, queryText: callQuery \}\)/);
});
