import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../js/stamps.js", import.meta.url), "utf8");
test("邮票册缩略图：动图缩成小动图、换 th2_ 键重做、熔卡时一起删", () => {
  assert.match(s, /if \(blob && blob\.type === "image\/gif"\) return await makeGifThumb\(blob\);/);
  assert.match(s, /const tk = "th2_" \+ ref;/);
  assert.match(s, /idbImgDel\("th2_" \+ k\)/);
});
