"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const engine = fs.readFileSync("js/engine.js", "utf8");
const start = engine.indexOf("const MEM_STOP");
const end = engine.indexOf("// 群聊记忆分流", start);
const formatStart = engine.indexOf("function formatMemLib", end);
const formatEnd = engine.indexOf("// 月度精炼", formatStart);
assert.ok(start >= 0 && end > start && formatStart > end && formatEnd > formatStart);

function runtime(vectorRows) {
  const vectors = new Map(vectorRows || []);
  const sandbox = {
    window: {}, console, Date, Set, Map, Math, Object, JSON, Float32Array,
    saveJSON() {},
    getQueryVec: () => ({ m: "test-embed", v: Float32Array.from([1, 0]) }),
    _memVecCache: () => vectors,
    cosSim(a, b) {
      let dot = 0, aa = 0, bb = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
      return dot / Math.sqrt(aa * bb);
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(engine.slice(start, end) + "\n" + engine.slice(formatStart, formatEnd) +
    "\nthis.retrieveMemories=retrieveMemories;this.formatMemLib=formatMemLib;this.copyMemoryRecallMeta=copyMemoryRecallMeta;", sandbox);
  return sandbox;
}

test("新近度和情绪不能让无关记忆越过相关性准入闸", () => {
  const s = runtime();
  const now = Date.now();
  const rows = [
    { id: "hit", text: "Lisa 和他一起吃过海胆饭", tags: ["食物"], charIds: ["c1"], ts: now, a: 1 },
    { id: "noise", text: "今天刚买了一把雨伞", tags: ["日常"], charIds: ["c1"], ts: now, a: 5 }
  ];
  const got = s.retrieveMemories(rows, "c1", "海胆饭", { source: "chat", vec: false, limit: 4 });
  assert.deepEqual(Array.from(got, x => x.id), ["hit"]);
  const receipt = s.window.MemoryRecallSnapshot.get("c1");
  assert.equal(receipt.picked[0].recallKind, "main");
  const noise = receipt.excluded.find(x => x.id === "noise");
  assert.equal(noise.reason, "relevance_gate");
  assert.ok(noise.score > 0.9, "它确实会被旧版单总分规则误收");
  assert.equal(noise.scoreParts.lane, "none");
});

test("语义近但不够直接的记忆有独立联想位，不抢主召回名额", () => {
  const assoc = Float32Array.from([0.53, Math.sqrt(1 - 0.53 * 0.53)]);
  const s = runtime([
    ["main", { m: "test-embed", v: Float32Array.from([1, 0]) }],
    ["assoc", { m: "test-embed", v: assoc }]
  ]);
  const now = Date.now();
  const got = s.retrieveMemories([
    { id: "main", text: "alpha memory", tags: [], charIds: ["c1"], ts: now },
    { id: "assoc", text: "beta echo", tags: [], charIds: ["c1"], ts: now }
  ], "c1", "alpha", { source: "chat", limit: 1, associationLimit: 1 });
  assert.deepEqual(Array.from(got, x => x.id), ["main", "assoc"]);
  const receipt = s.window.MemoryRecallSnapshot.get("c1");
  assert.equal(receipt.picked.find(x => x.id === "main").recallKind, "main");
  assert.equal(receipt.picked.find(x => x.id === "assoc").recallKind, "association");
  assert.match(s.formatMemLib(got), /〔顺带联想到〕beta echo/);
});

test("空召回只在真实聊天注入诚实状态，后台预览保持空", () => {
  const s = runtime();
  const live = s.retrieveMemories([], "c1", "还记得吗", { source: "chat", vec: false });
  assert.match(s.formatMemLib(live), /没有相关长期记忆入选/);
  const preview = s.retrieveMemories([], "c1", "还记得吗", { source: "background", touch: false, vec: false });
  assert.equal(s.formatMemLib(preview), "");
  const lean = s.copyMemoryRecallMeta(live, live.slice());
  assert.match(s.formatMemLib(lean), /不要编造过去/);
});

test("诊断页展示入选分解、落选原因和权限隔离计数", () => {
  const screens = fs.readFileSync("js/screens.js", "utf8");
  assert.match(screens, /查看没进来的候选/);
  assert.match(screens, /没有词面或足够语义证据/);
  assert.match(screens, /权限隔离/);
  assert.match(screens, /recallPartsText/);
});
