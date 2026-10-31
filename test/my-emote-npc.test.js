// 她自己画的表情包：跟她用同一张面具聊的人都能用，配角也算（群友 2026-10-31）
require("node:test")("__me: 那一套按面具认，不看画好时写死的名单", () => {
  const assert = require("node:assert/strict");
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /\.filter\(pk => String\(pk\.fromCharFace \|\| ""\)\.indexOf\("__me:"\) === 0\n\s*\? String\(maskKeyOf\(charId\) \|\| ""\) === String\(pk\.fromCharFace\)\.slice\(5\)/);
});
