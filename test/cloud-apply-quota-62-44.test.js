// v62.44 热修：apply 落地前 base64 收进图库、失败清单+半份禁推（审计 P0 当晚真实应验）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "cloud.js"), "utf8");
test("apply：x_characters/x_profile 的 data: 图先 imgToVault，setItem 逐键 try", () => {
  const seg = src.slice(src.indexOf("async apply(data)"), src.indexOf("frozen = true;"));
  assert.match(seg, /deflateImgs/);
  assert.match(seg, /row\[f\]\.indexOf\("data:"\) === 0/);
  assert.match(seg, /catch \(e\) \{ applyFailed\.push\(k\); \}/);
  assert.match(seg, /x_cloudApplyFailed_v1/);
  assert.match(seg, /apply_partial/);
});
test("autoPush：apply_partial 或失败旗在时绝不上云", () => {
  const seg = src.slice(src.indexOf("async autoPush()"), src.indexOf("async autoPull()"));
  assert.match(seg, /apply_partial/);
  assert.match(seg, /x_cloudApplyFailed_v1/);
});
