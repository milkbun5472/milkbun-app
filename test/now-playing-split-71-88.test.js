"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const engine = fs.readFileSync("js/engine.js", "utf8");
const rooms = fs.readFileSync("js/chat-rooms.js", "utf8");

// 她 2026-09-19：「正在放什么歌」和「一起听过哪些歌」原来挤在一栏里共用同一道认知闸，
// 于是关了记忆的房间（不带出门 / 长篇如果 / 默认全关的庭院房）连同一间屋里
// 正响着的歌都听不见。前者是此刻在场的东西，后者才是记忆。
test("正在放什么 和 一起听过哪些 是两栏", () => {
  assert.match(app, /^    nowPlaying: \(\(\) => \{/m, "没拆出「正在放什么」那一栏");
  assert.match(app, /^    listenLog: \(\(\) => \{/m, "「一起听过」那一栏没了");
  assert.match(engine, /ctx\.nowPlaying && ctx\.nowPlaying\.trim\(\)/, "拼提示词时没发新那一栏");
  assert.match(engine, /ctx\.listenLog && ctx\.listenLog\.trim\(\)/, "旧那一栏不发了");
});

test("正在放的歌跟着「在场」走，听过的留在记忆那一组", () => {
  const gate = rooms.slice(rooms.indexOf("const CTX_GATE = {"), rooms.indexOf("const bools ="));
  const always = gate.slice(gate.indexOf("always: ["), gate.indexOf("formalMemory: ["));
  assert.match(always, /"nowPlaying"/, "关了记忆的房间又听不见正在放的歌了");
  assert.doesNotMatch(always, /"listenLog"/, "听过哪些歌不该哪间房都给——那是记忆");
  assert.match(gate.slice(gate.indexOf("formalMemory: [")), /"listenLog"/, "听过哪些歌从记忆那一组掉出来了");
});

// ⚠️拆之前这几处清的是整栏（含正在放的歌）：拆开之后两栏都要清，行为不许悄悄变。
test("原来清整栏的地方，两栏都要清", () => {
  assert.equal((app.match(/listenLog: "", nowPlaying: ""/g) || []).length, 2, "刻唱片那两处漏了新那一栏");
  assert.match(engine, /listenLog: "", nowPlaying: ""/, "写日记那条轻线漏了新那一栏");
});
