"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");

// 她 2026-09-19：「小世界里面能不能设置语音开关开了就每个气泡念完再到下一个气泡念」
test("念出来这个开关有，而且念完这句才冒下一句", () => {
  assert.match(html, /id="read-aloud"/, "开关那颗按钮没了");
  assert.match(game, /const VOICE_KEY='x_fairyGardenVoice';/, "开关不记在这台设备上");
  const fn = game.slice(game.indexOf("function nextBubble(){"), game.indexOf("// 一轮话可能有好几条"));
  assert.ok(fn.length > 300, "抠不出 nextBubble");
  assert.match(fn, /host\.readAloud\(item\.say\)\.then/, "没等念完就翻下一只气泡了");
  assert.match(fn, /bubbleTimer=setTimeout\(nextBubble,VOICE_GAP\)/, "念完之后没接着冒下一句");
});

// ⚠️念不了（没配语音 API / 他没有音色 / 合成失败）不许把气泡卡死。
test("念不了就退回原来的定时，不许卡住", () => {
  const fn = game.slice(game.indexOf("function nextBubble(){"), game.indexOf("// 一轮话可能有好几条"));
  assert.match(fn, /const fallback=\(\)=>/, "没有退路");
  assert.match(fn, /\.catch\(fallback\)/, "合成炸了就没人管了");
  assert.match(fn, /if\(!ok\)\{fallback\(\);return;\}/, "宿主说念不了时没退回定时");
  // v74.075 起庭院和列车共用 makeAloud 那一份
  const bridge = host.slice(host.indexOf("readAloud:async text=>"), host.indexOf("stopAloud:()=>"));
  assert.ok(bridge.length > 300, "抠不出 readAloud");
  assert.match(bridge, /return false;/, "念不了的时候没老实说");
  assert.match(bridge, /ttsSpeak/, "另起了一套合成——那是又开一处要付钱的地方");
});

// 她 2026-09-19 问「小世界里也知道在放啥歌」时查出来的：
// 房间那条路一直传着 mainline，小世界这条路从来没传过。
test("小世界那条路也接上主线底子，不再是薄的", () => {
  assert.match(app, /mainlineFor: charId =>/, "主屏那条路没给");
  assert.match(app, /buildBundle\(ctxFor\(c, \{ chat: true \}\)\)/, "给的不是 buildBundle 那一份");
  assert.match(host, /const mainlineNow = \(\) => \{/, "庭院这边没有那一处公共的取法");
  assert.equal(host.match(/propsRef\.current\.mainline\b/g).length, 1,
    "取主线的地方不止一处——房间那条和小世界那条会走散");
  assert.ok(host.match(/mainlineNow\(\)/g).length >= 8, "还有调用点没换成公共那一处");
});
