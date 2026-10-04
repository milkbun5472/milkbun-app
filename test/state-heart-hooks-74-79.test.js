// 她 2026-10-05：「状态卡爱心有挂点吗」→「要，要可以改图案」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), ts = R("theme-studio.js");

test("那颗心拆成几层挂点，名单里都登记了", () => {
  ["stateheart", "stateheartline", "stateheartbase", "stateheartfill", "stateheartnum"].forEach(k => {
    assert.match(comp, new RegExp('"data-wk": "' + k + '"'), k + " 没挂上");
    assert.match(ts, new RegExp('\\["' + k + '", "'), k + " 没登记，秋秋不知道有它");
  });
});

test("形状和颜色写 CSS 就能换：行内不写死变量，层里 var(她的, 默认)", () => {
  const i = comp.indexOf('"data-wk": "stateheart"'), seg = comp.slice(i, i + 400);
  assert.doesNotMatch(seg, /"--sc-heart-mask":/, "行内写了形状变量，她的 CSS 压不过");
  assert.doesNotMatch(seg, /"--sc-heart-ink":/, "行内写了颜色变量，她的 CSS 压不过");
  assert.match(comp, /WebkitMaskImage: "var\(--sc-heart-mask, " \+ SC_HEART_MASK \+ "\)"/);
  assert.match(comp, /var\(--sc-heart-ink, var\(--sc-heart-ink-auto\)\)/);
});
