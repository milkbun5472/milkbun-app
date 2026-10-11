// 群友 2026-10-11：「小手机有自定义虚拟时间的功能么？包括年月日时间。平时主玩线下，经常需要调整时间」
//   她：「直接在时间感知那里搞个虚拟时间和流逝速度，也可以手动调；悬浮球要是开了虚拟时间可以在这里面直接调」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const engine = R("engine.js"), app = R("app.js"), screens = R("screens.js"), comps = R("components.js");
const grab = name => { const i = engine.indexOf("function " + name + "("); assert.ok(i >= 0, name); return engine.slice(i, engine.indexOf("\n}\n", i) + 3); };

test("戏里现在＝定下的时间＋现实过去的×速度；关着就是现实时间", () => {
  const win = {};
  const E = new Function("window", grab("vclockCfg") + grab("vclockMap") + grab("vclockNow") + grab("fmtClock") + grab("fmtStampAI") + "\nreturn { vclockMap, vclockNow, fmtStampAI };")(win);
  const now = Date.now();
  assert.equal(E.vclockMap(now), now);
  const base = new Date(1999, 11, 31, 23, 0).getTime();
  win.__vclock = { on: true, base, at: now - 3600e3, speed: 2 };
  assert.equal(E.vclockMap(now), base + 7200e3, "现实过了一小时、两倍速＝戏里过了两小时");
  win.__vclock = { on: true, base, at: now - 3600e3, speed: 0 };
  assert.equal(E.vclockMap(now), base, "停住就一直停在那一刻");
  assert.equal(E.vclockNow().getFullYear(), 1999);
  assert.match(E.fmtStampAI(now), /^今天23:00$/, "历史上的时间戳也照戏里的走");
});

test("四处报时都走虚拟时间：单人（含线下）、群线下、群线上、通话", () => {
  assert.match(engine, /timeAware\n  \} = ctx;\n  const now = vclockNow\(\);/);
  assert.match(engine, /const now = vclockNow\(\);\n  \/\/ 时间感知（跟随全局开关）/);
  assert.equal((app.match(/【此刻时间】现在是 " \+ \(typeof vclockNow === "function" \? vclockNow\(\) : new Date\(\)\)/g) || []).length, 2);
  assert.match(engine, /if \(vclockCfg\(\)\) timeBlock\.push\("【当前真实时间】"/, "缓存切点那几个字不能动");
});

test("设置页时间感知下面一块、悬浮球里开着时能直接拨；app 每次画都同步给 engine", () => {
  assert.match(comps, /function VClockEditor\(\{ v, onChange, compact \}\)/);
  assert.match(screens, /h\(VClockEditor, \{ v: p\.vclock, onChange: v => save\(\{ \.\.\.p, vclock: v \}\) \}\)/);
  assert.match(app, /vclock: prefs\.vclock && prefs\.vclock\.on \? prefs\.vclock : null,/);
  assert.match(app, /h\(VClockEditor, \{ v: vclock, onChange: onVClock, compact: true \}\)/);
  assert.match(app, /window\.__vclock = prefs\.vclock && prefs\.vclock\.on \? prefs\.vclock : null;/);
});
