const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const gz = fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");

// 群友 2026-10-05：「这个和关于我/关于我们有挂点嘛」
test("Ta 眼里那页每一块都有挂点，而且都登记进了秋秋的名单", () => {
  const hooks = ["gazepage", "gazetitle", "gazetab", "gazestatus", "gazecard", "gazecardname", "gazecardtext", "gazecardtime", "gazebtn", "gazeletter", "gazehistory"];
  for (const k of hooks) {
    assert.ok(gz.includes('"data-wk": "' + k + '"'), "gaze.js 没挂 " + k);
    assert.ok(ts.includes('["' + k + '"'), "秋秋名单里没有 " + k);
  }
  assert.match(gz, /"data-wk": "gazecard", "data-k": fk, "data-empty"/);
});
