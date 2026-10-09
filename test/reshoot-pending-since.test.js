const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("reshooting an old photo shows 拍照中 (stale check uses pendingSince)", () => {
  assert.match(comp, /const since = m\.pendingSince \|\| m\.ts;\s*if \(since && Date\.now\(\) - since > 360000\)/);
  assert.equal((app.match(/pending: true, failed: false, imgKey: null, imgUrl: null, pendingSince: Date\.now\(\)/g) || []).length, 2);
  // 线下照片重拍不先清旧图（群友 2026-10-09：拍坏了旧照片就没了）：拍成才换，拍坏放回去
  assert.match(app, /const q = \{ desc: scene, pending: true, failed: false, pendingSince: Date\.now\(\) \};/);
});
