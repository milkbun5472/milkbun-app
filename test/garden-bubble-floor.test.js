"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("node:fs").readFileSync("apps/fairy-garden/game.mjs", "utf8");

// 她 2026-09-18：「气泡在太下面了」
test("气泡有上限也有下限，不许贴着下面那张纸的边", () => {
  assert.match(game, /function bubbleTop\(el,y\)\{/);
  assert.match(game, /const bottom=sceneBottom\(\), floor=bottom-Math\.max\(12,\(bottom-SCENE_TOP\)\*\.18\);/);
  assert.match(game, /return Math\.min\(Math\.max\(y-19,SCENE_TOP\+el\.offsetHeight\),floor\);/);
  assert.match(game, /那句话被挤在最后一道缝里/);
  // 三只都走同一处：他的、她的、那个「有话要说」的记号
  assert.equal((game.match(/bubbleTop\(/g) || []).length, 4, "一次定义三处调用");
});

// ⚠️聊天开着的时候盖住画面的是手机那一侧那张纸，不是行动栏
test("「画面露出多少」只有一处答案", () => {
  assert.match(game, /function sceneBottom\(\)\{/);
  assert.match(game, /if\(chatting\)return innerHeight\*\(1-CHAT_SHEET\);/);
  assert.match(game, /行动栏那时是 visibility:hidden/);
  // 藏不藏气泡那一道闸也问它，不然会出现「气泡还在，人却判成看不见了」
  assert.match(game, /const panelTop=sceneBottom\(\)-12;const offscreen=/);
  assert.doesNotMatch(game, /const panelTop=\$\('action-panel'\)\.getBoundingClientRect\(\)\.top-12/);
});
