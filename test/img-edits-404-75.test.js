// 带参考照走出图接口 404：说清楚是哪扇门没开、往哪儿走（群友 2026-10-16）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
test("edits 404 时报人话", () => {
  assert.ok(/useRef && refBlobs\.length && r && r\.status === 404\)\n\s+throw new Error\("这个站的出图接口不收参考照/.test(src));
});
