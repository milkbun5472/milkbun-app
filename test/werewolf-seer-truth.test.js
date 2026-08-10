const test = require("node:test");
const assert = require("node:assert/strict");
const { seerTruthViolations, enforceSeerTruth } = require("../js/games.js");

test("true seer cannot give a checked wolf gold water", () => {
  const speakers = [{ name: "预言家甲", role: "seer", seerKnown: [{ name: "狼人乙", isWolf: true }] }];
  const result = { speeches: [{ name: "预言家甲", text: "我昨晚验了狼人乙，他是我的金水。" }], claims: [{ name: "预言家甲", text: "我给狼人乙金水" }], stances: [] };
  const bad = seerTruthViolations(speakers, result);
  assert.deepEqual(bad, [{ seerName: "预言家甲", target: "狼人乙", isWolf: true }]);
  const fixed = enforceSeerTruth(result, bad);
  assert.match(fixed.speeches[0].text, /狼人乙是查杀/);
  assert.equal(fixed.claims[0].text, "我查杀了狼人乙");
});

test("true seer cannot call a checked good player a wolf", () => {
  const speakers = [{ name: "预言家甲", role: "seer", seerKnown: [{ name: "好人丙", isWolf: false }] }];
  const result = { speeches: [{ name: "预言家甲", text: "我查杀好人丙，今天先出他。" }], claims: [], stances: [] };
  assert.equal(seerTruthViolations(speakers, result).length, 1);
});

test("fake seer wolf may fabricate checks", () => {
  const speakers = [{ name: "悍跳狼", role: "wolf", seerKnown: [] }];
  const result = { speeches: [{ name: "悍跳狼", text: "我给狼队友金水。" }], claims: [{ name: "悍跳狼", text: "我给狼队友金水" }], stances: [] };
  assert.deepEqual(seerTruthViolations(speakers, result), []);
});

test("true seer may hide a result without being forced to reveal it", () => {
  const speakers = [{ name: "预言家甲", role: "seer", seerKnown: [{ name: "狼人乙", isWolf: true }] }];
  const result = { speeches: [{ name: "预言家甲", text: "今天我先听一轮发言。" }], claims: [], stances: [] };
  assert.deepEqual(seerTruthViolations(speakers, result), []);
});
