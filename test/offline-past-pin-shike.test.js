const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 她 2026-10-13：「往期线下记录不能补收进时刻」
test("往期线下记录能挑几段收进时刻，单人和群线下都接上", () => {
  const r = c.slice(c.indexOf("function OfflineSessionReader("), c.indexOf("function OfflinePastSessions("));
  assert.match(r, /"data-wk": "offreadpin", onClick: \(\) => setPick\(\[\]\)/);
  assert.match(r, /offPickCard\(h\(OffCard,/, "没用跟进行中同一套挑选");
  assert.match(r, /h\(OffPickBar, \{ t, pick, setPick, onPin: idx => onPinShike\(idx\.map\(k => msgs\[k\]\)\) \}\)/);
  assert.equal((c.match(/h\(OfflineSessionReader, \{[^\n]*onPinShike \}\)/g) || []).length, 2, "单人、群线下的往期没都递 onPinShike");
});
