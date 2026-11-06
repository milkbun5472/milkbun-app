import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("重拍失败时描述留新的，不退回旧描述", () => {
  assert.match(src, /imgUrl: keep\.imgUrl \|\| null, desc: scene \}/);
  assert.doesNotMatch(src, /desc: keep\.desc != null \? keep\.desc : scene/);
});
test("拍不了的时候改的描述也先存下", () => {
  const i = src.indexOf("const reshootOffShot");
  const body = src.slice(i, i + 3000);
  assert.match(body, /if \(!offlinePhotoCan\(char\)\) \{ if \(desc != null\)/);
});
