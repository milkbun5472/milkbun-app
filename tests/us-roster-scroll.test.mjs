import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../js/screens.js", import.meta.url), "utf8");
test("情侣名册：进某一段前记位置，退回名册放回去", () => {
  assert.match(s, /const openView = id => \{ if \(rosterRef\.current\) rosterScrollRef\.current = rosterRef\.current\.scrollTop; setView\(id\); \}/);
  assert.match(s, /if \(view === null && rosterRef\.current && rosterScrollRef\.current > 0\) rosterRef\.current\.scrollTop = rosterScrollRef\.current/);
  assert.match(s, /ref: rosterRef, "data-part": "usroster"/);
  assert.match(s, /onClick: \(\) => tog && openView\(e\.char\.id\)/);
});
