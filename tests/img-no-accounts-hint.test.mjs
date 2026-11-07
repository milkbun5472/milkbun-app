import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
test("中转号池没号：单独说清，不往「不锁脸」上指", () => {
  const i = eng.indexOf("no available (?:compatible )?accounts?"), j = eng.indexOf("这个站要是不收参考照");
  assert.ok(i > 0 && i < j);
});
