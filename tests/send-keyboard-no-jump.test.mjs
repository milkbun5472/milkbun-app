import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("单聊发送：只有安卓才失焦重聚焦，iPhone 键盘不跳", () => {
  assert.match(src, /const reset = keep && ANDROID;/);
  assert.doesNotMatch(src, /const reset = keep && \(ANDROID \|\| composing\.current\)/);
});
