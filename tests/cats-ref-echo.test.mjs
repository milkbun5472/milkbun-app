import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
test("CatsAPI 原样退回参考照不算成品：先滤掉同字节的，再按字节比一遍，退回就报错", () => {
  const i = eng.indexOf("原样退回参考照（她 2026-11-07"), body = eng.slice(i, i + 2600);
  assert.ok(i > 0);
  assert.match(body, /sentRefs\.has\(pureOf\(it\.b64_json\)\)/);
  assert.match(body, /parseOut\(poll, JSON\.stringify\(\{ data: picked \}\)\)/);
  assert.match(body, /for \(const rb of refBlobs\) if \(await same\(out\.blob, rb\)\) throw/);
});
