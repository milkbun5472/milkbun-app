// 线下旁白（群友 2026-10-09：「许愿一个线下有旁白」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const A = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("单人线下、群线下都能切旁白；发出去是 narration，跟线上同一种", () => {
  assert.equal((C.match(/const \[narrMode, setNarrMode\] = useState\(false\);/g) || []).length, 2);
  assert.equal((C.match(/if \(narrMode && onNarr\) \{ onNarr\(v\); return; \}/g) || []).length, 2);
  assert.equal((C.match(/"data-wk": "offnarrbtn"/g) || []).length, 2);
  assert.match(A, /onNarr: txt => pushOffMsg\(activeOfflineScopeKey, \{ id: "n_" \+ Date\.now\(\), role: "narration", kind: "narration"/);
  assert.match(A, /onNarr: txt => pushGOffMsg\(offlineGroup\.id, \{ id: "gn_" \+ Date\.now\(\), role: "narration", kind: "narration"/);
});
