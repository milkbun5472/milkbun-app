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

test("受控随机永远固定 top-1，且同一轮同一查询结果稳定", () => {
  const a = entry("a"), b = entry("b"), c = entry("c"), d = entry("d");
  const input = {
    pool: [{ e: a, s: 10 }, { e: b, s: 9 }, { e: c, s: 8.8 }, { e: d, s: 8.7 }],
    relevant: [a, b, c, d],
    limit: 4,
    isCooling: () => false,
    tieSeed: "char|turn7|query"
  };
  const one = select(input).proposed.map(x => x.id);
  const two = select(input).proposed.map(x => x.id);
  assert.equal(one[0], "a");
  assert.deepEqual(one, two);
});

test("不同轮可以在 95% 同分窗口内换序，但绝不把窗外条目混进来", () => {
  const a = entry("a"), b = entry("b"), c = entry("c"), d = entry("d"), far = entry("far");
  const orders = new Set();
  for (let turn = 0; turn < 20; turn++) {
    const result = select({
      pool: [{ e: a, s: 10 }, { e: b, s: 9 }, { e: c, s: 8.8 }, { e: d, s: 8.7 }, { e: far, s: 7 }],
      relevant: [a, b, c, d],
      limit: 4,
      isCooling: () => false,
      tieSeed: "char|" + turn + "|query"
    });
    const ids = result.proposed.map(x => x.id);
    assert.equal(ids[0], "a");
    assert.equal(ids.includes("far"), false);
    orders.add(ids.slice(1).join(","));
  }
  assert.ok(orders.size > 1);
});
