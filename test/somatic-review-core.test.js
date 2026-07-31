"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Review = require("../js/somatic-review-core.js");

test("五感评审聚合样本、事件、来源和 CC 回流，不带正文", () => {
  const result = Review.summarize([
    { report: { sampleCount: 6, surfaces: { private: 4, cc_ledger: 2 }, eventCounts: { touch: 3 } } },
    { report: { sampleCount: 5, surfaces: { offline: 5 }, eventCounts: { smell: 1, taste: 1 } } }
  ]);
  assert.equal(result.sampleCount, 11);
  assert.equal(result.eventCount, 5);
  assert.equal(result.ccReplaySamples, 2);
  assert.equal(result.automaticPromotionAllowed, false);
  assert.equal(JSON.stringify(result).includes("正文"), false);
});

test("样本不足、长期零命中和来源失衡只亮机械提示，不自动转正", () => {
  assert.equal(Review.summarize([]).warnings[0].code, "insufficient_samples");
  const silent = Review.summarize([{ report: { sampleCount: 20, surfaces: { private: 20 }, eventCounts: {} } }]);
  assert.ok(silent.warnings.some(x => x.code === "no_detected_events"));
  assert.ok(silent.warnings.some(x => x.code === "single_source_dominance"));
  assert.equal(silent.enoughForHumanReview, false);
  assert.equal(silent.automaticPromotionAllowed, false);
});
