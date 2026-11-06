import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("匿名箱的回答走 TransText，外语也有译文", () => {
  assert.match(src, /h\(TransText, \{ text: r\.a, zhReady: r\.zh, ink: A\.sub \}\)/);
});
test("没答时留的那句反应也带译文", () => {
  assert.match(src, /h\(TransText, \{ text: "（" \+ r\.note \+ "）", zhReady: r\.noteZh, ink: A\.fog \}\)/);
});
