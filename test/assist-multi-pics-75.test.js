// 秋秋一次能发好几张图（她 2026-10-16）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/assistant.js"), "utf8");
test("多选、最多 6 张、整组发给模型、记录里摆一排缩略图", () => {
  assert.ok(/const ASSIST_PICS_MAX = 6;/.test(src));
  assert.ok(/accept: "image\/\*", multiple: true/.test(src));
  assert.ok(/pic\.pics && pic\.pics\.length > 1 \? pic\.pics\.map\(x => x\.full\) : pic\.full/.test(src));
  assert.ok(/imageDataUrls: img \? \(Array\.isArray\(img\) \? img : \[img\]\)/.test(src));
  assert.ok(/m\.pics && m\.pics\.length > 1\n/.test(src));
});
