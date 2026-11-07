import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
test("CatsAPI 那条路：要动图时 params 里带上格式、帧数、每帧多久", () => {
  assert.match(eng, /opts && opts\.gif \? \{ output_format: "gif", frame_count: Math\.max\(2, Math\.min\(16, Number\(opts\.gifFrames\)/);
});
