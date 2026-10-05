const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 群友 2026-10-05：「我想回到开头（或者中间某一段）怎么办」——原来只摆最后 16 句
test("挑一句接起：整段都能挑，能往前翻、能搜", () => {
  const i = comp.indexOf("function ChatRoomSheet("), j = comp.indexOf("\nfunction ", i + 10);
  assert.ok(i > 0 && j > i, "抠不出 ChatRoomSheet");
  const seg = comp.slice(i, j);
  assert.doesNotMatch(seg, /\.slice\(-16\)/, "又只摆最后 16 句了");
  assert.match(seg, /allStartChoices\.slice\(-startShowN\)/);
  assert.match(seg, /setStartShowN\(n => n \+ 40\)/);
  assert.match(seg, /x\.text\.indexOf\(startQs\) >= 0/);
  // hooks 得在提前 return 之前
  assert.ok(seg.indexOf("useState(40)") < seg.indexOf("if (!Kit || !draft) return"), "hooks 排在提前 return 后面了");
});
