// 她 2026-10-05 截图：心声卡上心情一栏写着「[object Object]」——模型把 label 也写成了对象
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/mood-label.js");
test("label 是对象时剥开取词；已经存坏的「[object Object]」当空的", () => {
  assert.equal(M.normalizeMood({ label: { label: "烦躁" } }).label, "烦躁");
  assert.equal(M.localize({ zh: "吃醋" }), "吃醋");
  assert.equal(M.localize("[object Object]"), "");
  assert.equal(M.localize("happy"), "开心");
});
