import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
test("CatsAPI 照接入说明：size 发宽高比、另带 resolution；动图只发 output_format", () => {
  assert.match(eng, /const catsSize = \/1536\\s\*x\\s\*1024\/i\.test\(size\) \? "4:3"/);
  assert.match(eng, /params: Object\.assign\(\{ size: catsSize, resolution: "1k", quality: catsQuality/);
  assert.match(eng, /opts && opts\.gif \? \{ output_format: "gif" \} : \{\}/);
});
