const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
// 她 2026-10-17：照相馆挑了衣服，拍出来两个人穿的不是挑的那身
test("照相馆挑了衣服：不再发此刻穿着、固定服装锁、我的固定服装和衣柜清单", () => {
  const seg = app.slice(app.indexOf("const studioShoot = "), app.indexOf("const studioShoot = ") + 30000);
  assert.match(seg, /hisPicked \? Object\.assign\(\{\}, char, \{ photoOutfit: "" \}\) : char, sceneFull,/);
  assert.match(seg, /hisPicked && st \? Object\.assign\(\{\}, st, \{ wearing: "", wearingUpdatedAt: 0 \}\) : st,/);
  assert.match(seg, /Object\.assign\(\{\}, me, \{ outfit: "", closet: "" \}\) : me,/);
});
