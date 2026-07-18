"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const D = require("../js/dream-loop-core.js");

const T0 = Date.UTC(2026, 6, 18, 4, 0, 0); // UTC 时刻，配合 offset 测夜键

test("材料包只存引用+hash，正文绝不外泄", () => {
  const m = D.buildMaterial({ chatItems: [{ id: "m1", content: "今晚吃了绿咖喱很开心" }, { id: "m2", content: "秘密内容" }] });
  assert.equal(m.refs.length, 2);
  const json = JSON.stringify(m);
  assert.ok(!json.includes("绿咖喱") && !json.includes("秘密"));
  assert.equal(m.refs[0].kind, "chat");
  assert.ok(m.refs[0].hash.length > 0);
});

test("1B 情绪阈值制：无材料/平静夜不做梦，达标才入梦", () => {
  assert.equal(D.shouldDream(D.buildMaterial({}), {}).reason, "no_material");
  const calm = D.buildMaterial({ chatItems: [{ id: "a", content: "x" }], emotionCurrent: { warmth: 0.1 } });
  assert.equal(D.shouldDream(calm, {}).reason, "calm_night");
  const hot = D.buildMaterial({ chatItems: [{ id: "a", content: "x" }], emotionCurrent: { hurt: 0.6, valence: -0.4 } });
  const v = D.shouldDream(hot, {});
  assert.equal(v.dream, true);
  assert.equal(v.reason, "intensity_met");
});

test("强度合成：关系轴 active 与余温加成，封顶 1", () => {
  const m = D.buildMaterial({ chatItems: [{ id: "a", content: "x" }], emotionCurrent: { anger: 0.9 }, relationActiveAxes: ["neglect", "boundary"], afterglowLevel: 1 });
  assert.ok(m.intensity <= 1);
  assert.ok(m.intensity >= 0.9);
  assert.deepEqual(m.relationActiveAxes, ["neglect", "boundary"]);
});

test("REM 窗：睡满 90 分钟才到点，醒着永不到点", () => {
  const asleep = { phase: "asleep", sleepStartTs: T0 };
  assert.equal(D.remDue(asleep, T0 + 89 * 60000), false);
  assert.equal(D.remDue(asleep, T0 + 90 * 60000), true);
  assert.equal(D.remDue({ phase: "awake", sleepStartTs: T0 }, T0 + 999 * 60000), false);
});

test("夜键：凌晨入睡归前一晚；幂等键一角色一夜唯一", () => {
  const lateNight = Date.UTC(2026, 6, 18, 2, 0, 0); // 当地(offset 0)凌晨2点入睡
  assert.equal(D.nightKeyOf(lateNight, 0), "2026-07-17");
  const evening = Date.UTC(2026, 6, 18, 22, 30, 0);
  assert.equal(D.nightKeyOf(evening, 0), "2026-07-18");
  assert.equal(D.dreamKey("c1", "2026-07-18"), D.dreamKey("c1", "2026-07-18"));
  assert.notEqual(D.dreamKey("c1", "2026-07-18"), D.dreamKey("c2", "2026-07-18"));
});

test("入梦材料窗覆盖前一白天到凌晨入睡，不被午夜截断", () => {
  const sleep = Date.UTC(2026, 6, 18, 8, 0, 0); // 温哥华 07-18 01:00，归 07-17 夜
  const offset = -7 * 60;
  const night = D.nightKeyOf(sleep, offset);
  const w = D.nightWindow(night, offset, sleep);
  assert.equal(night, "2026-07-17");
  assert.equal(w.startTs, Date.UTC(2026, 6, 17, 7, 0, 0));
  assert.equal(w.endTs, sleep);
  assert.ok(Date.UTC(2026, 6, 17, 20, 0, 0) >= w.startTs);
});

test("材料重建同时核验 hash，编辑后的同 ID 消息不可冒充", () => {
  const ref = D.buildMaterial({ chatItems: [{ id: "m1", content: "原话" }] }).refs[0];
  assert.equal(D.refMatches(ref, "原话"), true);
  assert.equal(D.refMatches(ref, "改过的话"), false);
});

test("决定论：同输入两次结果逐位一致（不掷骰子）", () => {
  const input = { chatItems: [{ id: "a", content: "x" }, { id: "b", content: "y" }], emotionCurrent: { hurt: 0.5, warmth: 0.3 }, relationActiveAxes: ["identity"], afterglowLevel: 0.4 };
  assert.deepEqual(D.buildMaterial(input), D.buildMaterial(input));
});
