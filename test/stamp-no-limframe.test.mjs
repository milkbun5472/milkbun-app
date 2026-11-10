import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../js/stamps.js", import.meta.url), "utf8");
test("限定、生日、纪念日卡不再画框（挂点留着、透明）", () => {
  const i = s.indexOf("function LimMark"), b = s.slice(i, s.indexOf("function StampFace", i));
  assert.match(b, /"data-wk": "stamplimmark", "data-tone": tone\[1\]/);
  assert.doesNotMatch(b, /boxShadow/);
});
