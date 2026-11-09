// 海龟汤 / 25 问：每轮挑人提问时人设跟着走，voiceBrief 才写得出「说话的样子」（2026-11-01）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
test("GuessGame 的提问名单带 persona 和 char", () => {
  const a = src.indexOf("function GuessGame("), body = src.slice(a, a + 6000);
  assert.match(body, /alive: p\.alive, persona: p\.persona \|\| "", char: p\.char \|\| null \}/);
});
test("所有挑人名单都带着人设", () => {
  const lines = src.split("\n").filter(l => /name: p\.name, skill: p\.skill/.test(l));
  assert.ok(lines.length >= 3);
  lines.forEach(l => assert.match(l, /persona: p\.persona/));
});
