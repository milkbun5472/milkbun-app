"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Tidal = require("../js/inner-life-e-tidal-core.js");

const T0 = Date.UTC(2026, 6, 17, 5, 0, 0);
const state = (name, signalTs = null) => ({ state: name, signalTs, signalKind: signalTs == null ? "boot" : "sleep", updatedTs: T0 });

test("晚安消息只分类成睡眠事件，不会再变成普通打字", () => {
  const hit = Tidal.classifyTidalMessage("宝宝晚安，我睡了");
  assert.equal(hit.event, Tidal.EVENTS.SLEEP_SIGNAL);
  const result = Tidal.reduceTidal(state("awake"), hit.event, T0);
  assert.equal(result.next.state, "maybe_sleeping");
  assert.equal(result.next.signalTs, T0);
});

test("明确清醒与普通真实消息都会醒来", () => {
  assert.equal(Tidal.classifyTidalMessage("我醒了宝宝").event, Tidal.EVENTS.WAKE_SIGNAL);
  assert.equal(Tidal.reduceTidal(state("maybe_sleeping", T0), Tidal.EVENTS.WAKE_SIGNAL, T0 + 1).next.state, "awake");
  assert.equal(Tidal.reduceTidal(state("maybe_sleeping", T0), Tidal.EVENTS.USER_TYPED_MESSAGE, T0 + 1).next.state, "awake");
});

test("否定句不会误判成睡眠", () => {
  for (const text of ["我还没睡", "宝宝别睡", "今晚睡不着", "我不困"]) {
    const hit = Tidal.classifyTidalMessage(text);
    assert.equal(hit.event, Tidal.EVENTS.USER_TYPED_MESSAGE, text);
    assert.equal(hit.rule, "sleep_negated", text);
  }
});

test("90 分钟边界内不醒也不转 uncertain，超过才转", () => {
  const sleeping = state("maybe_sleeping", T0);
  assert.equal(Tidal.reduceTidal(sleeping, Tidal.EVENTS.SESSION_OPEN_NO_MESSAGE, T0 + Tidal.SLEEP_WINDOW_MS).next.state, "maybe_sleeping");
  assert.equal(Tidal.reduceTidal(sleeping, Tidal.EVENTS.FOREGROUND_TICK_NO_MESSAGE, T0 + Tidal.SLEEP_WINDOW_MS + 1).next.state, "uncertain");
});

test("新窗口、前台和重载类事件本身永远不能判醒", () => {
  for (const event of [Tidal.EVENTS.SESSION_OPEN_NO_MESSAGE, Tidal.EVENTS.FOREGROUND_TICK_NO_MESSAGE]) {
    assert.notEqual(Tidal.reduceTidal(state("uncertain"), event, T0 + 1).next.state, "awake");
    assert.notEqual(Tidal.reduceTidal(state("maybe_sleeping", T0), event, T0 + 1).next.state, "awake");
  }
});

test("新的睡眠信号刷新 90 分钟窗口", () => {
  const old = state("maybe_sleeping", T0);
  const refreshed = Tidal.reduceTidal(old, Tidal.EVENTS.SLEEP_SIGNAL, T0 + 80 * 60 * 1000).next;
  assert.equal(refreshed.signalTs, T0 + 80 * 60 * 1000);
  assert.equal(Tidal.reduceTidal(refreshed, Tidal.EVENTS.SESSION_OPEN_NO_MESSAGE, T0 + 160 * 60 * 1000).next.state, "maybe_sleeping");
});

test("空文本不制造事件；坏输入和未知事件不抛错", () => {
  assert.equal(Tidal.classifyTidalMessage("   ").event, null);
  assert.doesNotThrow(() => Tidal.reduceTidal(null, "UNKNOWN", T0));
  assert.equal(Tidal.reduceTidal(null, "UNKNOWN", T0).next.state, "awake");
  assert.equal(Tidal.reduceTidal(state("uncertain"), "UNKNOWN", T0).next.state, "uncertain");
});
