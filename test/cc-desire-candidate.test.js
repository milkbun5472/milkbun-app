const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../js/heart.js");

test("CC 欲望候选只进纸条、不直写正式念想，并按账本事件幂等", () => {
  const box = window.HeartKit.boxOf({}, "yanqiu");
  const candidate = { text:"我想和她一起养一盆薄荷", quote:"我想以后和你一起养一盆薄荷。" };
  assert.equal(window.HeartKit.ingestCcCandidate(box, candidate, "cc:k:1", 123), true);
  assert.equal(box.list.length, 0);
  assert.equal(box.briefs.length, 1);
  assert.equal(box.briefs[0].candidateText, candidate.text);
  assert.equal(window.HeartKit.ingestCcCandidate(box, candidate, "cc:k:1", 456), false);
  assert.equal(box.briefs.length, 1);
});

test("坏候选安静拒绝，不污染盒子", () => {
  const box = window.HeartKit.boxOf({}, "yanqiu");
  assert.equal(window.HeartKit.ingestCcCandidate(box, { text:"", quote:"原话" }, "cc:k:2", 123), false);
  assert.equal(box.briefs.length, 0);
});
