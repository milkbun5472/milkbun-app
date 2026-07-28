const test = require("node:test");
const assert = require("node:assert/strict");
const { select } = require("../js/recall-cooling.js");

const entry = (id, extra = {}) => ({ id, text: id, ...extra });

test("top-1 永远固定，冷却只下调其余条目", () => {
  const a = entry("a"), b = entry("b"), c = entry("c"), d = entry("d");
  const result = select({
    pool: [{ e: a, s: 10 }, { e: b, s: 9 }, { e: c, s: 8 }, { e: d, s: 7 }],
    relevant: [a, b, c],
    limit: 3,
    isCooling: id => id === "a" || id === "b"
  });
  assert.deepEqual(result.proposed.map(x => x.id), ["a", "c", "d"]);
  assert.deepEqual(result.cooled.map(x => x.id), ["b"]);
});

test("open 永不冷却，未解决的事仍可反复浮现", () => {
  const a = entry("a"), open = entry("open", { open: true }), c = entry("c");
  const result = select({
    pool: [{ e: a, s: 10 }, { e: open, s: 9 }, { e: c, s: 8 }],
    relevant: [a, open],
    limit: 2,
    isCooling: () => true
  });
  assert.deepEqual(result.proposed.map(x => x.id), ["a", "open"]);
  assert.equal(result.cooled.some(x => x.id === "open"), false);
});

test("冷却窗口没有替补时不制造空召回", () => {
  const a = entry("a"), b = entry("b");
  const result = select({
    pool: [{ e: a, s: 10 }, { e: b, s: 9 }],
    relevant: [a, b],
    limit: 4,
    isCooling: id => id === "b"
  });
  assert.deepEqual(result.proposed.map(x => x.id), ["a", "b"]);
});
