"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/games.js");

const lisa = { name: "Lisa", isUser: true };
const yanqiu = { name: "许言秋", engineer: true };
const npc = { name: "阿屿" };

test("瓶子优先补给本局被指次数较少的人", () => {
  const log = [
    { type: "spin", name: "许言秋" },
    { type: "spin", name: "许言秋" },
    { type: "spin", name: "阿屿" },
  ];
  assert.equal(G.tdPickFairTarget([yanqiu, lisa, npc], log, "阿屿", "play", () => 0).name, "Lisa");
});

test("两人局由另一人出题，真人不会再被排除", () => {
  assert.equal(G.tdPickNextAsker([yanqiu, lisa], "许言秋", "").name, "Lisa");
  assert.equal(G.tdPickNextAsker([yanqiu, lisa], "Lisa", "Lisa").name, "许言秋");
});

test("多人局出题权按座次轮转且跳过被提问者", () => {
  assert.equal(G.tdPickNextAsker([yanqiu, lisa, npc], "阿屿", "许言秋").name, "Lisa");
  assert.equal(G.tdPickNextAsker([yanqiu, lisa, npc], "许言秋", "Lisa").name, "阿屿");
});

test("截图里的现场沉浸扮演属于大冒险，不是真心话", () => {
  const prompt = "请你现场即兴沉浸式扮演一个被代码逼疯的人，并瞬间切换成温柔夹子音。";
  assert.equal(G.tdLooksLikeDare(prompt), true);
  assert.equal(G.tdPromptMatchesChoice("真心话", prompt), false);
  assert.equal(G.tdPromptMatchesChoice("大冒险", prompt), true);
  assert.equal(G.tdPromptMatchesChoice("真心话", "你现在最怕在场的人误会你什么？"), true);
});
