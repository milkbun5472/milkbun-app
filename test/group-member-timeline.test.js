// 群里每位成员「别处的往来」并成一条时间线：私聊照拉条取最近几条、线下和别的互通群照时间窗（她 2026-11-05）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const a = R("app.js");
test("crossRecentFor 认 onlineN：私聊按最近几条取", () => {
  assert.match(a, /const _onlKeep = opts\.onlineN != null \? new Set\(_onl\.slice\(-Math\.max\(0, Number\(opts\.onlineN\) \|\| 0\)\)\) : null;/);
});
test("成员背景只调一次、三样一起排", () => {
  assert.match(a, /crossRecentFor\(c\.id, \{ surfaces: \["online", "offline", "group"\], onlineN: _pn, excludeGroup: opts\.groupId,/);
  assert.match(a, /已按真实时间先后排好/);
});
test("拉条上限 60", () => { assert.match(R("components.js"), /privN, setPrivN, 0, 60, 2, " 条"\)/); });
