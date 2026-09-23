// 她 2026-09-23 转来读者的话：「话说这个要怎么才有呀？一直没有」（解梦馆「TA们的梦」一直是空的）。
//
// 查下来：梦只有一种入队的路——睡眠 tick【恰好撞见】角色正睡着、而且已经入睡满 90 分钟。
// 可 tick 只在 app 开着的时候跑。大多数人是跟角色差不多时间睡的：那一整夜 app 都关着，
// 天亮一开，角色早醒了，这一夜梦回路从头到尾没见过——于是永远是空的。
// 补法：睡眠那头交出【最近一个睡完的夜】，那一夜睡满过 90 分钟就当 REM 窗到过，回头补一场。
"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../js/inner-life-c-sleep-core.js");
const D = require("../js/dream-loop-core.js");

const at = v => Date.parse(v);
const plan = (wake = "08:00", sleep = "23:30") => ({ seqs: [
  { time: wake, type: "coffee", title: "起床" }, { time: "13:00", type: "work", title: "工作" }, { time: sleep, type: "sleep", title: "睡觉" }
] });
const schedules = { "2026-07-16": plan(), "2026-07-17": plan(), "2026-07-18": plan() };

test("睡眠核交出最近一个睡完的夜——早上十点打开 app，看得见昨晚 23:30~08:00 那一觉", () => {
  const d = C.deriveSchedule(at("2026-07-17T10:00:00Z"), 0, schedules);
  assert.equal(d.phase, "awake", "早上十点角色是醒着的——原来的路在这儿就断了");
  assert.deepEqual(d.lastSleep, { start: at("2026-07-16T23:30:00Z"), wake: at("2026-07-17T08:00:00Z") });
  // tick 也照样递出来
  const r = C.tickSleep(C.createSleepState(at("2026-07-17T10:00:00Z")), { now: at("2026-07-17T10:00:00Z"), utcOffsetMinutes: 0, schedules });
  assert.deepEqual(r.lastSleep, d.lastSleep);
});

test("错过的那一夜：睡满过 90 分钟就补，按那一夜的入睡时刻、醒来那一刻判", () => {
  const last = { start: at("2026-07-16T23:30:00Z"), wake: at("2026-07-17T08:00:00Z") };
  const m = D.missedNight(last, at("2026-07-17T10:00:00Z"));
  assert.deepEqual(m, { state: { phase: "asleep", sleepStartTs: last.start }, asOf: last.wake });
  assert.equal(D.remDue(m.state, m.asOf), true, "补回来的那一份得能过 REM 那道闸");
  // 夜键跟正常那条路算出来的是同一个——一夜一梦的幂等才接得上
  assert.equal(D.nightKeyOf(m.state.sleepStartTs, 0), D.nightKeyOf(last.start, 0));
});

test("不该补的不补", () => {
  const now = at("2026-07-17T10:00:00Z");
  assert.equal(D.missedNight(null, now), null);
  assert.equal(D.missedNight({ start: at("2026-07-17T07:00:00Z"), wake: at("2026-07-17T08:00:00Z") }, now), null, "只睡了一小时，没到第一个 REM 窗");
  assert.equal(D.missedNight({ start: at("2026-07-15T23:30:00Z"), wake: at("2026-07-16T08:00:00Z") }, now + 36 * 3600000), null, "太久以前的那一夜，材料窗早过了");
  assert.equal(D.missedNight({ start: at("2026-07-16T23:30:00Z"), wake: at("2026-07-17T12:00:00Z") }, now), null, "还没醒的不是「睡完的夜」");
});

test("胶水：醒着的时候回头补，正睡着那条路照旧", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const i = app.indexOf("window.DreamLoop.observe(c, r.state)");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 900);
  assert.match(seg, /r\.state\.phase !== "asleep" && r\.lastSleep/);
  assert.match(seg, /window\.DreamLoopCore\.missedNight\(r\.lastSleep, Date\.now\(\)\)/);
  assert.match(seg, /window\.DreamLoop\.observe\(c, miss\.state, \{ asOf: miss\.asOf \}\)/);
  const shadow = fs.readFileSync(path.join(__dirname, "..", "js", "dream-loop-shadow.js"), "utf8");
  assert.match(shadow, /if \(!C\.remDue\(sleepState, at\)\) return null;/, "observe 还在拿「现在」判 REM，补回来的那一夜过不去");
  const sh = fs.readFileSync(path.join(__dirname, "..", "js", "inner-life-c-sleep-shadow.js"), "utf8");
  assert.match(sh, /return \{ exempt: false, state: r\.state, lastSleep: r\.lastSleep \|\| null \};/);
});
